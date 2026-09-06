import { createWriteStream } from 'node:fs';
import { mkdir, readdir, stat, rm, cp, rename } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
// archiver v7 es CJS (export =); sus tipos no casan con NodeNext+ESM, así que tipamos lo que usamos
interface Archive {
  on(event: 'error', cb: (err: Error) => void): void;
  pipe(dest: NodeJS.WritableStream): void;
  glob(pattern: string, opts: { cwd: string; ignore?: string[]; dot?: boolean }): void;
  file(path: string, opts: { name: string }): void;
  append(source: string | Buffer, opts: { name: string }): void;
  finalize(): Promise<void>;
}
const archiver = createRequire(import.meta.url)('archiver') as (format: 'zip', opts?: { zlib?: { level?: number } }) => Archive;

/** Zip streaming reutilizable (también lo usa el pack de mods). */
export function createZip(): Archive {
  return archiver('zip', { zlib: { level: 6 } });
}
import extractZip from 'extract-zip';
import cron from 'node-cron';
import { BACKUPS_DIR } from './paths.js';
import { listServers, getServer, serverDir, audit } from './store.js';
import { runtimeOf, sendCommand, waitForLine, lockOp, unlockOp, assertNotBusy } from './instance.js';
import { discordEvent } from './discord.js';

// no tiene sentido meter en el zip lo que se puede volver a descargar
const EXCLUDE_DIRS = new Set(['libraries', 'versions', 'cache', 'logs', 'crash-reports']);
// ni lo que se regenera solo: los tiles del mapa de BlueMap (pueden ser GB) y el candado del mundo
const EXCLUDE_GLOBS = ['bluemap/web/**', 'plugins/BlueMap/web/**', '**/session.lock', '*.jar', '**/*.part'];
const NAME_RE = /^[A-Za-z0-9._-]+$/;

type Broadcast = (type: string, payload: unknown) => void;
let broadcastFn: Broadcast = () => {};
export function setBackupBroadcast(fn: Broadcast): void { broadcastFn = fn; }

function backupDir(id: string): string {
  return path.join(BACKUPS_DIR, id);
}

export interface BackupInfo { name: string; size: number; createdAt: string; auto: boolean }

export async function listBackups(id: string): Promise<BackupInfo[]> {
  try {
    const files = await readdir(backupDir(id));
    const infos = await Promise.all(files.filter((f) => f.endsWith('.zip')).map(async (f) => {
      const st = await stat(path.join(backupDir(id), f));
      return { name: f.replace(/\.zip$/, ''), size: st.size, createdAt: st.mtime.toISOString(), auto: f.startsWith('auto_') };
    }));
    return infos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

const inProgress = new Set<string>();

export async function makeBackup(id: string, auto = false): Promise<BackupInfo> {
  const meta = await getServer(id);
  if (!meta) throw new Error('Servidor no encontrado');
  if (inProgress.has(id)) throw new Error('Ya hay un backup en curso');
  assertNotBusy(id); // p. ej. mientras se restaura otro backup
  inProgress.add(id);
  let saveOff = false;
  try {
    const running = runtimeOf(id).status === 'online';
    if (running) {
      sendCommand(id, 'save-off');
      saveOff = true;
      sendCommand(id, 'save-all flush');
      // esperar a que el server confirme el guardado (los mundos grandes tardan más de 3 s)
      const saved = await waitForLine(id, /Saved the game/i, 60_000);
      if (!saved) await new Promise((r) => setTimeout(r, 3000)); // sin confirmación: margen extra
    }
    // con segundos: dos backups en el mismo minuto (p. ej. cambio de versión + importar mundo) no se pisan
    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const name = `${auto ? 'auto' : 'manual'}_${stamp}`;
    const dest = path.join(backupDir(id), `${name}.zip`);
    await mkdir(backupDir(id), { recursive: true });

    try {
      await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(dest);
        const archive = archiver('zip', { zlib: { level: 6 } });
        output.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(output);
        archive.glob('**/*', {
          cwd: serverDir(id),
          ignore: [...EXCLUDE_DIRS].map((d) => `${d}/**`).concat(EXCLUDE_GLOBS),
          dot: true,
        });
        void archive.finalize();
      });
    } catch (err) {
      await rm(dest, { force: true }); // un zip a medias solo estorba
      throw err;
    }

    const st = await stat(dest);
    await audit('database', `Creó un backup de ${meta.name} (${(st.size / 1048576).toFixed(1)} MB)`, 'ok');
    void discordEvent(id, 'backup', `${name}.zip · ${(st.size / 1048576).toFixed(1)} MB`);
    broadcastFn('backup', { id, name });
    return { name, size: st.size, createdAt: st.mtime.toISOString(), auto };
  } finally {
    // pase lo que pase, el server no puede quedarse con el autoguardado apagado
    if (saveOff) { try { sendCommand(id, 'save-on'); } catch { /* el server ya no está en marcha */ } }
    inProgress.delete(id);
  }
}

function safeBackupPath(id: string, name: string): string {
  if (!NAME_RE.test(name)) throw new Error('Nombre de backup inválido');
  return path.join(backupDir(id), `${name}.zip`);
}

export const WORLD_DIRS = ['world', 'world_nether', 'world_the_end'];

/**
 * Restaura un backup. `mode: 'world'` (por defecto) solo devuelve el mundo; `'all'`
 * también server.properties, whitelist, ops, mods/plugins y configs tal como estaban.
 */
export async function restoreBackup(id: string, name: string, mode: 'world' | 'all' = 'world'): Promise<void> {
  const meta = await getServer(id);
  if (!meta) throw new Error('Servidor no encontrado');
  if (runtimeOf(id).status !== 'offline') throw new Error('Detén el servidor antes de restaurar');
  const zip = safeBackupPath(id, name);
  await stat(zip); // valida que existe
  // bloquea arrancar/backup/borrar mientras el mundo está a medio extraer
  lockOp(id, 'restaurando un backup');
  try {
    if (mode === 'all') {
      for (const dir of WORLD_DIRS) await rm(path.join(serverDir(id), dir), { recursive: true, force: true });
      // extract-zip, no `tar`: el GNU tar del contenedor Debian no sabe abrir ZIPs
      await extractZip(zip, { dir: serverDir(id) });
    } else {
      // se extrae aparte y solo se traen las carpetas del mundo
      const tmp = path.join(backupDir(id), `.restore-${name}`);
      await rm(tmp, { recursive: true, force: true });
      await extractZip(zip, { dir: tmp });
      const found = [];
      for (const dir of WORLD_DIRS) {
        try { await stat(path.join(tmp, dir)); found.push(dir); } catch { /* ese mundo no está en el zip */ }
      }
      if (!found.length) throw new Error('Ese backup no contiene ninguna carpeta de mundo');
      for (const dir of found) {
        await rm(path.join(serverDir(id), dir), { recursive: true, force: true });
        await cp(path.join(tmp, dir), path.join(serverDir(id), dir), { recursive: true });
      }
      await rm(tmp, { recursive: true, force: true });
    }
    await audit('refresh', `Restauró ${mode === 'all' ? 'todo' : 'el mundo'} del backup ${name} en ${meta.name}`, 'warn');
  } finally {
    unlockOp(id);
  }
}

/** Un zip subido por el usuario pasa a ser un backup manual más (y se restaura por la vía normal). */
export async function adoptUploadedBackup(id: string, tmpPath: string): Promise<BackupInfo> {
  const meta = await getServer(id);
  if (!meta) throw new Error('Servidor no encontrado');
  await mkdir(backupDir(id), { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  const name = `manual_${stamp}_subido`;
  const dest = path.join(backupDir(id), `${name}.zip`);
  await rename(tmpPath, dest);
  const st = await stat(dest);
  await audit('upload', `Subió un backup (${(st.size / 1048576).toFixed(1)} MB) a ${meta.name}`, 'ok');
  return { name, size: st.size, createdAt: st.mtime.toISOString(), auto: false };
}

/** Mundo subido como zip: se restaura como si fuera un backup «solo mundo». */
export async function importWorldZip(id: string, tmpPath: string): Promise<void> {
  const meta = await getServer(id);
  if (!meta) throw new Error('Servidor no encontrado');
  if (runtimeOf(id).status !== 'offline') throw new Error('Detén el servidor antes de importar un mundo');
  lockOp(id, 'importando un mundo');
  try {
    const tmp = path.join(backupDir(id), '.import-world');
    await rm(tmp, { recursive: true, force: true });
    try {
      await extractZip(tmpPath, { dir: tmp });
    } catch {
      throw new Error('El archivo no es un .zip válido (¿está corrupto o es otro formato, como .rar o .7z?)');
    } finally {
      await rm(tmpPath, { force: true });
    }
    // el zip puede traer world/ directamente, o los ficheros del mundo en la raíz (level.dat), o una carpeta con otro nombre
    let src: string | null = null;
    const entries = await readdir(tmp, { withFileTypes: true });
    if (entries.some((e) => e.name === 'level.dat')) src = tmp;
    else if (entries.some((e) => e.isDirectory() && e.name === 'world')) src = path.join(tmp, 'world');
    else {
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        try { await stat(path.join(tmp, e.name, 'level.dat')); src = path.join(tmp, e.name); break; } catch { /* seguir */ }
      }
    }
    if (!src) throw new Error('El zip no parece un mundo de Minecraft (no encuentro level.dat)');
    await rm(path.join(serverDir(id), 'world'), { recursive: true, force: true });
    await cp(src, path.join(serverDir(id), 'world'), { recursive: true });
    // nether y end si vienen al lado (formato de servidor)
    for (const dir of ['world_nether', 'world_the_end']) {
      try {
        await stat(path.join(tmp, dir));
        await rm(path.join(serverDir(id), dir), { recursive: true, force: true });
        await cp(path.join(tmp, dir), path.join(serverDir(id), dir), { recursive: true });
      } catch { /* no vienen */ }
    }
    await rm(tmp, { recursive: true, force: true });
    await audit('upload', `Importó un mundo en ${meta.name}`, 'warn');
  } finally {
    unlockOp(id);
  }
}

export async function deleteBackup(id: string, name: string): Promise<void> {
  await rm(safeBackupPath(id, name), { force: true });
  await audit('trash', `Eliminó el backup ${name}`, 'warn');
}

export function backupFilePath(id: string, name: string): string {
  return safeBackupPath(id, name);
}

/** Borra las copias automáticas más antiguas que sobren; devuelve cuántas quitó. */
export async function pruneAuto(id: string, keep: number): Promise<number> {
  const autos = (await listBackups(id)).filter((b) => b.auto);
  const old = autos.slice(keep);
  for (const b of old) {
    await rm(path.join(backupDir(id), `${b.name}.zip`), { force: true });
  }
  return old.length;
}

/** Hora y días del backup automático de un servidor (defaults: 04:00, todos los días). */
export function backupSchedule(meta: { backupTime?: string; backupDays?: number[] }): { time: string; days: number[] } {
  const time = /^\d{2}:\d{2}$/.test(meta.backupTime ?? '') ? meta.backupTime! : '04:00';
  const days = meta.backupDays?.length ? meta.backupDays : [0, 1, 2, 3, 4, 5, 6];
  return { time, days };
}

// backup automático: cada minuto se mira qué servidores tienen su hora (hora local, TZ del compose)
export function scheduleAutoBackups(): void {
  let lastKey = '';
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const key = `${now.toDateString()} ${hhmm}`;
    if (key === lastKey) return; // el mismo minuto no dispara dos veces
    lastKey = key;
    for (const meta of await listServers()) {
      if (meta.provision.status !== 'ready') continue;
      if (meta.backupAuto === false) continue;
      const { time, days } = backupSchedule(meta);
      if (time !== hhmm || !days.includes(now.getDay())) continue;
      try {
        await makeBackup(meta.id, true);
        await pruneAuto(meta.id, meta.backupKeep ?? 7);
      } catch (err) {
        console.error(`[backup] ${meta.name}:`, err);
      }
    }
  });
}
