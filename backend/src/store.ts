import { readFile, mkdir, appendFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, SERVERS_DIR } from './paths.js';
import { writeFileAtomic } from './util.js';

export type Loader = 'vanilla' | 'paper' | 'fabric' | 'forge' | 'neoforge';

/** Carpeta de contenido: los servidores de plugins (Paper) usan plugins/, los de mods mods/. */
export function contentDirName(loader: Loader): 'mods' | 'plugins' { return loader === 'paper' ? 'plugins' : 'mods'; }
/** Vanilla puro no admite nada; el resto sí (plugins o mods). */
export function supportsContent(loader: Loader): boolean { return loader !== 'vanilla'; }

export type LaunchSpec =
  | { type: 'jar'; jar: string }
  | { type: 'args'; argsDir: string }; // dir con win_args.txt / unix_args.txt (Forge y NeoForge modernos)

export interface ServerMeta {
  id: string;
  name: string;
  loader: Loader;
  mcVersion: string;
  loaderVersion?: string;
  javaMajor: number;
  port: number;
  memoryMb: number;
  createdAt: string;
  provision: { status: 'creating' | 'ready' | 'error'; log: string[]; error?: string };
  launch?: LaunchSpec;
  backupAuto?: boolean; // default true
  backupKeep?: number;  // default 7
  cpuCores?: number;    // 0/ausente = todos los núcleos
  autoRestart?: boolean; // default true — watchdog: reinicia solo tras un crash
  desiredRunning?: boolean; // estaba encendido la última vez (lo mantiene instance.ts)
  autoStart?: boolean; // default true — volver a arrancarlo solo tras reiniciar el Umbrel / CraftDeck
  aikarFlags?: boolean; // default true — flags de JVM de Aikar (G1GC afinado)
  publicAddress?: string; // «dominio:puerto» con el que entran los amigos desde fuera (redirección del router, playit…)
  pinnedLoaderVersion?: string; // versión exacta del loader que pide un modpack (se usa al aprovisionar)
  modpack?: { project: string; name: string; versionId: string; versionNumber: string }; // de dónde salió el servidor
  backupTime?: string;   // "HH:MM" del backup automático (default 04:00)
  backupDays?: number[]; // días de la semana (0=domingo); ausente = todos los días
  mapPort?: number;      // puerto local del webserver de BlueMap (solo dentro del contenedor)
  idleStopMinutes?: number; // 0/ausente = nunca; si lleva N minutos sin nadie, se apaga (modo dormido)
  wakeOnConnect?: boolean;  // default true: mientras duerme, escucha en su puerto y arranca cuando alguien entra
  sleeping?: boolean;       // se apagó por inactividad (al arrancar CraftDeck se vuelve a poner a escuchar)
  serverIcon?: boolean;     // hay server-icon.png (lo enseñan los launchers de los amigos)
  discord?: { url: string; onStatus: boolean; onPlayers: boolean; onBackup: boolean; chatMirror: boolean };
}

const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.jsonl');

let servers: ServerMeta[] | null = null;

async function load(): Promise<ServerMeta[]> {
  if (servers) return servers;
  try {
    servers = JSON.parse(await readFile(SERVERS_FILE, 'utf8')) as ServerMeta[];
  } catch {
    servers = [];
  }
  return servers;
}

async function persist(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFileAtomic(SERVERS_FILE, JSON.stringify(servers ?? [], null, 2));
}

export async function listServers(): Promise<ServerMeta[]> {
  return load();
}

export async function getServer(id: string): Promise<ServerMeta | undefined> {
  return (await load()).find((s) => s.id === id);
}

export async function addServer(meta: ServerMeta): Promise<void> {
  const all = await load();
  all.push(meta);
  await persist();
}

export async function updateServer(id: string, patch: Partial<ServerMeta>): Promise<ServerMeta> {
  const all = await load();
  const idx = all.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error(`Servidor no encontrado: ${id}`);
  all[idx] = { ...all[idx]!, ...patch };
  await persist();
  return all[idx]!;
}

export async function removeServer(id: string): Promise<void> {
  const all = await load();
  servers = all.filter((s) => s.id !== id);
  await persist();
}

export function serverDir(id: string): string {
  return path.join(SERVERS_DIR, id);
}

export async function nextFreePort(): Promise<number> {
  const used = new Set((await load()).map((s) => s.port));
  // el compose de Umbrel solo mapea 25565-25574: no repartir puertos inalcanzables
  for (let p = 25565; p <= 25574; p++) if (!used.has(p)) return p;
  throw new Error('Sin puertos libres (máximo 10 servidores en el rango 25565-25574)');
}

export async function audit(action: string, detail: string, level: 'info' | 'warn' | 'err' | 'ok' = 'info'): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(AUDIT_FILE, JSON.stringify({ at: new Date().toISOString(), action, detail, level }) + '\n');
  try {
    // rotación: que el log no crezca sin límite en el disco del Umbrel
    if ((await stat(AUDIT_FILE)).size > 512 * 1024) {
      const lines = (await readFile(AUDIT_FILE, 'utf8')).trim().split('\n');
      await writeFileAtomic(AUDIT_FILE, lines.slice(-400).join('\n') + '\n');
    }
  } catch { /* rotación best-effort */ }
}

export async function readAudit(limit = 60): Promise<{ at: string; action: string; detail: string; level: string }[]> {
  try {
    const lines = (await readFile(AUDIT_FILE, 'utf8')).trim().split('\n');
    return lines.slice(-limit).reverse().map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}
