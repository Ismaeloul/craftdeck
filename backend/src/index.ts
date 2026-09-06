import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { rm, mkdir, cp, readFile, writeFile, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { FRONTEND_DIR, BACKUPS_DIR, CACHE_DIR, APP_VERSION } from './paths.js';
import { listVanillaVersions } from './catalog/vanilla.js';
import { listFabricGameVersions } from './catalog/fabric.js';
import { listForgeVersions } from './catalog/forge.js';
import { listNeoForgeVersions } from './catalog/neoforge.js';
import { listPaperVersions } from './catalog/paper.js';
import { provisionServer } from './provision.js';
import { listModpackVersions, inspectModpack, applyModpack, writeMrpack } from './modpacks.js';
import { isBlueMapInstalled, installBlueMap, blueMapReachable, proxyBlueMap, mapPortFor } from './bluemap.js';
import { playerHistory } from './players-history.js';
import { cmpVersion } from './util.js';
import {
  setBroadcast, runtimeOf, consoleForPanel, startServer, stopServer, sendCommand, stopAll, announceInGame, assertNotBusy,
  autoStartServers, runningMemoryMb, forgetServer, metricsHistory,
} from './instance.js';
import { storageInfo } from './storage.js';
import { listDatapacks, installDatapack, removeDatapack, toggleDatapack, addUploadedDatapack } from './datapacks.js';
import { systemMemory } from './system.js';
import { playerLists, playerAction, whitelistAdd, whitelistRemove } from './players.js';
import {
  listBackups, makeBackup, restoreBackup, deleteBackup, backupFilePath,
  scheduleAutoBackups, setBackupBroadcast, pruneAuto, adoptUploadedBackup, importWorldZip, backupSchedule,
} from './backups.js';
import {
  readProperties, writeProperties, listEditableFiles, readEditableFile, writeEditableFile,
} from './properties.js';
import { listMods, installMod, removeMod, toggleMod, checkModUpdates, updateMod, migrateMods, addUploadedJar, clientPack, contentDir, ensureSideInfo } from './mods.js';
import { createZip } from './backups.js';
import { playerStats } from './stats.js';
import { listCrashes, crashText } from './crashes.js';
import {
  listEvents, addEvent, toggleEvent, deleteEvent, removeEventsOfServer, initEvents, EventType, Schedule,
} from './events.js';
import { testWebhook } from './discord.js';
import { playitStatus, startPlayit, stopPlayit, setPlayitBroadcast, setPlayitAutoStart, initPlayit } from './playit.js';
import {
  Loader, ServerMeta, listServers, getServer, addServer, removeServer, updateServer,
  serverDir, nextFreePort, audit, readAudit, supportsContent,
} from './store.js';

const PORT = Number(process.env.PORT ?? 8449);
const LOADERS: Loader[] = ['vanilla', 'paper', 'fabric', 'forge', 'neoforge'];

/** Versiones de MC disponibles para un loader (para validar creaciones y cambios de versión). */
async function catalogVersions(loader: Loader): Promise<string[]> {
  switch (loader) {
    case 'vanilla': return (await listVanillaVersions()).map((v) => v.id);
    case 'paper': return (await listPaperVersions()).map((v) => v.id);
    case 'fabric': return listFabricGameVersions();
    case 'forge': return (await listForgeVersions()).map((v) => v.mc);
    case 'neoforge': return (await listNeoForgeVersions()).map((v) => v.mc);
  }
}

/** Recibe un archivo subido como cuerpo crudo (streaming a un temporal); devuelve la ruta. */
async function receiveUpload(req: express.Request, maxBytes: number): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const tmp = path.join(CACHE_DIR, `upload-${crypto.randomUUID()}`);
  let bytes = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      bytes += chunk.length;
      if (bytes > maxBytes) cb(new Error(`Archivo demasiado grande (máximo ${Math.round(maxBytes / 1048576)} MB)`));
      else cb(null, chunk);
    },
  });
  try {
    await pipeline(req, limiter, createWriteStream(tmp));
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
  if (!bytes) { await rm(tmp, { force: true }); throw new Error('No llegó ningún archivo'); }
  return tmp;
}

const app = express();
// el editor de archivos admite hasta 512 KB; el límite por defecto (100 KB) devolvía 413 al guardar
app.use(express.json({ limit: '2mb' }));

// ---- eventos en vivo ----
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
export function broadcast(type: string, payload: unknown): void {
  const msg = JSON.stringify({ type, ...(payload as object) });
  for (const client of wss.clients) if (client.readyState === WebSocket.OPEN) client.send(msg);
}

const asyncRoute = (fn: (req: express.Request, res: express.Response) => Promise<void>) =>
  (req: express.Request, res: express.Response) => {
    fn(req, res).catch((err) => {
      console.error(err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    });
  };

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'craftdeck', version: APP_VERSION });
});

// ---- sistema: RAM del Umbrel para avisar antes de asignar más de la que hay ----
app.get('/api/system', asyncRoute(async (req, res) => {
  const mem = await systemMemory();
  const exceptId = typeof req.query.except === 'string' ? req.query.except : undefined;
  res.json({
    ...mem,
    cpus: os.cpus().length,
    // RAM ya comprometida por los servidores encendidos (sin contar el que se está ajustando)
    runningServersMb: await runningMemoryMb(exceptId),
  });
}));

// ---- catálogo de versiones ----
app.get('/api/catalog/:loader', asyncRoute(async (req, res) => {
  const loader = req.params.loader as Loader;
  if (!LOADERS.includes(loader)) { res.status(400).json({ error: `Loader desconocido: ${String(loader)}` }); return; }
  res.json({ loader, versions: await catalogVersions(loader) });
}));

// ---- modpacks de Modrinth: versiones publicadas de un pack (el asistente elige una) ----
app.get('/api/modpacks/:project/versions', asyncRoute(async (req, res) => {
  if (!/^[\w-]+$/.test(req.params.project!)) { res.status(400).json({ error: 'Proyecto inválido' }); return; }
  res.json({ versions: await listModpackVersions(req.params.project!) });
}));

// ---- servidores ----
app.get('/api/servers', asyncRoute(async (_req, res) => {
  const all = await listServers();
  res.json(all.map((s) => ({ ...s, runtime: runtimeOf(s.id) })));
}));

app.get('/api/servers/:id', asyncRoute(async (req, res) => {
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  res.json({ ...meta, runtime: runtimeOf(meta.id) });
}));

// ---- ciclo de vida ----
app.post('/api/servers/:id/start', asyncRoute(async (req, res) => {
  await startServer(req.params.id!);
  res.json({ ok: true });
}));

app.post('/api/servers/:id/stop', asyncRoute(async (req, res) => {
  await stopServer(req.params.id!);
  await audit('stop', 'Detuvo el servidor', 'warn');
  res.json({ ok: true });
}));

app.post('/api/servers/:id/restart', asyncRoute(async (req, res) => {
  await stopServer(req.params.id!);
  await startServer(req.params.id!);
  res.json({ ok: true });
}));

app.post('/api/servers/:id/command', asyncRoute(async (req, res) => {
  const { command } = req.body as { command?: string };
  if (!command?.trim()) { res.status(400).json({ error: 'Comando vacío' }); return; }
  sendCommand(req.params.id!, command.trim());
  await audit('terminal', `Ejecutó /${command.trim()}`, 'info');
  res.json({ ok: true });
}));

app.get('/api/servers/:id/console', asyncRoute(async (req, res) => {
  res.json({ lines: await consoleForPanel(req.params.id!) });
}));

// ---- reintentar un aprovisionado que falló (sin tener que borrar y crear de nuevo) ----
app.post('/api/servers/:id/provision/retry', asyncRoute(async (req, res) => {
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  if (meta.provision.status !== 'error') { res.status(400).json({ error: 'Este servidor no tiene una creación fallida que reintentar' }); return; }
  meta.provision = { status: 'creating', log: [] };
  await updateServer(meta.id, { provision: meta.provision });
  await audit('refresh', `Reintentó la creación de ${meta.name}`, 'info');
  void provisionServer(meta, broadcast);
  broadcast('servers', {});
  res.json({ ok: true });
}));

// ---- jugadores ----
app.get('/api/servers/:id/players', asyncRoute(async (req, res) => {
  const id = req.params.id!;
  res.json({ online: runtimeOf(id).players, ...(await playerLists(id)) });
}));

app.post('/api/servers/:id/players/:name/:action', asyncRoute(async (req, res) => {
  const { reason } = (req.body ?? {}) as { reason?: string };
  await playerAction(req.params.id!, req.params.action!, req.params.name!, reason);
  res.json({ ok: true });
}));

app.post('/api/servers', asyncRoute(async (req, res) => {
  const { name, memoryMb, acceptEula, modpackVersionId } = req.body as {
    name?: string; loader?: Loader; version?: string; memoryMb?: number; acceptEula?: boolean; modpackVersionId?: string;
  };
  let { loader, version } = req.body as { loader?: Loader; version?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'Falta el nombre del servidor' }); return; }
  if (!acceptEula) { res.status(400).json({ error: 'Debes aceptar la EULA de Mojang' }); return; }

  // desde un modpack: el loader y la versión los dicta el propio pack
  let pinnedLoaderVersion: string | undefined;
  if (modpackVersionId) {
    if (!/^[\w-]+$/.test(modpackVersionId)) { res.status(400).json({ error: 'Versión de modpack inválida' }); return; }
    const info = await inspectModpack(modpackVersionId);
    loader = info.loader; version = info.game; pinnedLoaderVersion = info.loaderVersion || undefined;
  }
  if (!loader || !LOADERS.includes(loader)) { res.status(400).json({ error: 'Loader inválido' }); return; }
  if (!version) { res.status(400).json({ error: 'Falta la versión de Minecraft' }); return; }

  const meta: ServerMeta = {
    id: crypto.randomUUID().slice(0, 8),
    name: name.trim(),
    loader,
    mcVersion: version,
    javaMajor: 21,
    port: await nextFreePort(),
    memoryMb: Math.min(Math.max(memoryMb ?? 2048, 1024), 16384),
    createdAt: new Date().toISOString(),
    provision: { status: 'creating', log: [] },
    ...(pinnedLoaderVersion ? { pinnedLoaderVersion } : {}),
  };
  await addServer(meta);
  // continúa en segundo plano: primero el contenido del modpack (si lo hay), luego Java + loader
  void (async () => {
    if (modpackVersionId) {
      try {
        await applyModpack(meta, modpackVersionId, async (msg) => {
          meta.provision.log.push(msg);
          await updateServer(meta.id, { provision: meta.provision }).catch(() => {});
          broadcast('provision', { id: meta.id, status: 'creating', msg });
        });
      } catch (err) {
        meta.provision.status = 'error';
        meta.provision.error = `Modpack: ${err instanceof Error ? err.message : String(err)}`;
        await updateServer(meta.id, { provision: meta.provision }).catch(() => {});
        broadcast('provision', { id: meta.id, status: 'error', msg: meta.provision.error });
        return;
      }
    }
    await provisionServer(meta, broadcast);
  })();
  res.status(201).json(meta);
}));

// ---- cambiar la versión de Minecraft (y opcionalmente vanilla ⇄ paper) conservando mundo y mods ----
app.post('/api/servers/:id/version', asyncRoute(async (req, res) => {
  const { version, loader: newLoader } = req.body as { version?: string; loader?: Loader };
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  if (!version) { res.status(400).json({ error: 'Falta la versión' }); return; }
  if (meta.provision.status !== 'ready') { res.status(400).json({ error: 'El servidor aún no está preparado' }); return; }
  if (runtimeOf(meta.id).status !== 'offline') { res.status(400).json({ error: 'Detén el servidor antes de cambiar de versión' }); return; }
  assertNotBusy(meta.id);
  let loader = meta.loader;
  if (newLoader && newLoader !== meta.loader) {
    // solo vanilla ⇄ paper comparten formato de mundo sin más; entre loaders de mods no se cambia
    const ok = ['vanilla', 'paper'].includes(meta.loader) && ['vanilla', 'paper'].includes(newLoader);
    if (!ok) { res.status(400).json({ error: 'Solo se puede cambiar entre Vanilla y Paper; para otro loader crea un servidor nuevo' }); return; }
    loader = newLoader;
  }
  if (!(await catalogVersions(loader)).includes(version)) { res.status(400).json({ error: `${loader} no tiene la versión ${version}` }); return; }
  if (version === meta.mcVersion && loader === meta.loader) { res.status(400).json({ error: 'Ya está en esa versión' }); return; }
  // los mundos no van hacia atrás: Minecraft se niega a abrir un mundo de una versión más nueva
  if (cmpVersion(version, meta.mcVersion) < 0) { res.status(400).json({ error: `Bajar de ${meta.mcVersion} a ${version} rompería el mundo: Minecraft no abre mundos de versiones más nuevas. Solo se puede subir.` }); return; }

  // red de seguridad: backup completo antes de tocar nada
  const backup = await makeBackup(meta.id, false);
  const from = `${meta.loader} ${meta.mcVersion}`;
  meta.loader = loader;
  meta.mcVersion = version;
  meta.provision = { status: 'creating', log: [`Backup previo: ${backup.name}.zip`, `Cambiando de ${from} a ${loader} ${version}…`] };
  await updateServer(meta.id, { loader, mcVersion: version, provision: meta.provision, pinnedLoaderVersion: undefined, modpack: undefined });
  broadcast('servers', {});
  await audit('refresh', `Cambió ${meta.name} de ${from} a ${loader} ${version}`, 'warn');
  void (async () => {
    await provisionServer(meta, broadcast);
    const fresh = await getServer(meta.id);
    if (fresh?.provision.status !== 'ready' || !supportsContent(loader)) return;
    try {
      const mig = await migrateMods(meta.id);
      const bits = [];
      if (mig.updated.length) bits.push(`${mig.updated.length} actualizados (${mig.updated.join(', ')})`);
      if (mig.kept.length) bits.push(`${mig.kept.length} ya compatibles`);
      if (mig.disabled.length) bits.push(`${mig.disabled.length} desactivados por no tener versión para ${version}: ${mig.disabled.join(', ')}`);
      if (mig.manual.length) bits.push(`${mig.manual.length} subidos a mano que debes revisar tú: ${mig.manual.join(', ')}`);
      const msg = `Mods tras el cambio: ${bits.join(' · ') || 'no había ninguno'}.`;
      fresh.provision.log.push(msg);
      await updateServer(meta.id, { provision: fresh.provision });
      broadcast('provision', { id: meta.id, status: 'ready', msg });
      broadcast('migration', { id: meta.id, ...mig });
    } catch (err) {
      broadcast('provision', { id: meta.id, status: 'ready', msg: `No pude revisar los mods: ${err instanceof Error ? err.message : err}` });
    }
  })();
  res.json({ ok: true, backup: backup.name });
}));

// ---- subidas: mod/plugin .jar, mundo en zip, backup en zip (cuerpo crudo, ?name=archivo) ----
app.post('/api/servers/:id/upload/:kind', asyncRoute(async (req, res) => {
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  const kind = req.params.kind!;
  const name = path.basename(String(req.query.name ?? '')).replace(/[^\w.\-+ '()\[\]]/g, '_');
  if (kind === 'mod') {
    if (!name.endsWith('.jar')) { res.status(400).json({ error: 'Solo se admiten archivos .jar' }); return; }
    const tmp = await receiveUpload(req, 512 * 1024 * 1024);
    await addUploadedJar(meta.id, name, tmp);
    res.status(201).json({ ok: true, filename: name });
  } else if (kind === 'world') {
    if (!name.endsWith('.zip')) { res.status(400).json({ error: 'El mundo debe ir en un .zip' }); return; }
    const tmp = await receiveUpload(req, 8 * 1024 * 1024 * 1024);
    await importWorldZip(meta.id, tmp);
    res.status(201).json({ ok: true });
  } else if (kind === 'backup') {
    if (!name.endsWith('.zip')) { res.status(400).json({ error: 'El backup debe ser un .zip' }); return; }
    const tmp = await receiveUpload(req, 8 * 1024 * 1024 * 1024);
    res.status(201).json(await adoptUploadedBackup(meta.id, tmp));
  } else if (kind === 'datapack') {
    if (!name.endsWith('.zip')) { res.status(400).json({ error: 'El datapack debe ser un .zip' }); return; }
    const tmp = await receiveUpload(req, 256 * 1024 * 1024);
    await addUploadedDatapack(meta.id, name, tmp);
    res.status(201).json({ ok: true, filename: name });
  } else if (kind === 'icon') {
    // server-icon.png: Minecraft exige PNG de exactamente 64x64
    const tmp = await receiveUpload(req, 2 * 1024 * 1024);
    const png = await readFile(tmp);
    await rm(tmp, { force: true });
    const isPng = png.length > 24 && png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const w = isPng ? png.readUInt32BE(16) : 0, h = isPng ? png.readUInt32BE(20) : 0;
    if (!isPng) { res.status(400).json({ error: 'El icono tiene que ser un PNG' }); return; }
    if (w !== 64 || h !== 64) { res.status(400).json({ error: `Minecraft exige 64×64 píxeles y este es de ${w}×${h}. Redimensiónalo (por ejemplo en Paint o en un editor online) y vuelve a subirlo.` }); return; }
    await writeFile(path.join(serverDir(meta.id), 'server-icon.png'), png);
    await updateServer(meta.id, { serverIcon: true });
    await audit('upload', `Puso icono al servidor ${meta.name}`, 'ok');
    res.status(201).json({ ok: true, needsRestart: runtimeOf(meta.id).status !== 'offline' });
  } else {
    res.status(400).json({ error: 'Tipo de subida desconocido' });
  }
}));

app.get('/api/servers/:id/icon', asyncRoute(async (req, res) => {
  const file = path.join(serverDir(req.params.id!), 'server-icon.png');
  try { await access(file); } catch { res.status(404).end(); return; }
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(file);
}));
app.delete('/api/servers/:id/icon', asyncRoute(async (req, res) => {
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  await rm(path.join(serverDir(meta.id), 'server-icon.png'), { force: true });
  await updateServer(meta.id, { serverIcon: false });
  res.json({ ok: true });
}));

// ---- datapacks (world/datapacks) ----
app.get('/api/servers/:id/datapacks', asyncRoute(async (req, res) => {
  res.json({ installed: await listDatapacks(req.params.id!) });
}));
app.post('/api/servers/:id/datapacks', asyncRoute(async (req, res) => {
  const { project } = req.body as { project?: string };
  if (!project || !/^[\w-]+$/.test(project)) { res.status(400).json({ error: 'Proyecto inválido' }); return; }
  res.status(201).json({ installed: await installDatapack(req.params.id!, project), applied: runtimeOf(req.params.id!).status === 'online' });
}));
app.delete('/api/servers/:id/datapacks/:filename', asyncRoute(async (req, res) => {
  await removeDatapack(req.params.id!, req.params.filename!);
  res.json({ ok: true });
}));
app.post('/api/servers/:id/datapacks/:filename/toggle', asyncRoute(async (req, res) => {
  const { enabled } = req.body as { enabled?: boolean };
  await toggleDatapack(req.params.id!, req.params.filename!, !!enabled);
  res.json({ ok: true });
}));

// ---- historial de métricas (24 h) y almacenamiento ----
app.get('/api/servers/:id/metrics/history', asyncRoute(async (req, res) => {
  res.json({ samples: await metricsHistory(req.params.id!) });
}));
app.get('/api/storage', asyncRoute(async (req, res) => {
  res.json(await storageInfo(req.query.refresh === '1'));
}));

// ---- logs comprimidos para pedir ayuda ----
app.get('/api/servers/:id/logs.zip', asyncRoute(async (req, res) => {
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  res.attachment(`craftdeck-${meta.name.replace(/[^\w-]+/g, '_')}-logs.zip`);
  const archive = createZip();
  archive.on('error', (err) => res.destroy(err));
  archive.pipe(res);
  archive.glob('**/*', { cwd: path.join(serverDir(meta.id), 'logs') });
  archive.glob('*.txt', { cwd: path.join(serverDir(meta.id), 'crash-reports') });
  archive.append(JSON.stringify({ ...meta, craftdeck: APP_VERSION, runtime: runtimeOf(meta.id) }, null, 2), { name: 'craftdeck-server.json' });
  archive.append(consoleForPanelText(await consoleForPanel(meta.id)), { name: 'consola-panel.txt' });
  await archive.finalize();
}));
function consoleForPanelText(lines: string[]): string { return lines.join('\n') + '\n'; }

// ---- clonar un servidor (mundo, mods y configuración a otro puerto; los backups no) ----
app.post('/api/servers/:id/clone', asyncRoute(async (req, res) => {
  const { name } = req.body as { name?: string };
  const src = await getServer(req.params.id!);
  if (!src) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  if (!name?.trim()) { res.status(400).json({ error: 'Ponle nombre al clon' }); return; }
  if (src.provision.status !== 'ready') { res.status(400).json({ error: 'El servidor original aún no está preparado' }); return; }
  if (runtimeOf(src.id).status !== 'offline') { res.status(400).json({ error: 'Detén el servidor antes de clonarlo (para copiar el mundo consistente)' }); return; }
  assertNotBusy(src.id);
  const meta: ServerMeta = {
    ...src,
    id: crypto.randomUUID().slice(0, 8),
    name: name.trim(),
    port: await nextFreePort(),
    createdAt: new Date().toISOString(),
    provision: { status: 'creating', log: [`Clonando «${src.name}»…`] },
    desiredRunning: false, sleeping: false, publicAddress: undefined, mapPort: undefined,
  };
  await addServer(meta);
  broadcast('servers', {});
  res.status(201).json(meta);
  void (async () => {
    try {
      const skip = new Set(['logs', 'crash-reports', 'session.lock', 'craftdeck-metrics.json', 'craftdeck-players.jsonl']);
      await cp(serverDir(src.id), serverDir(meta.id), {
        recursive: true,
        filter: (p) => !skip.has(path.basename(p)) && !/[\\/]bluemap[\\/]web[\\/]/.test(p),
      });
      await writeProperties(meta.id, { 'server-port': String(meta.port) });
      meta.provision = { status: 'ready', log: [`Clon de «${src.name}» listo.`] };
      await updateServer(meta.id, { provision: meta.provision });
      broadcast('provision', { id: meta.id, status: 'ready', msg: `Servidor «${meta.name}» listo.` });
      await audit('copy', `Clonó ${src.name} como ${meta.name} (puerto ${meta.port})`, 'ok');
    } catch (err) {
      meta.provision = { status: 'error', log: [], error: err instanceof Error ? err.message : String(err) };
      await updateServer(meta.id, { provision: meta.provision }).catch(() => {});
      broadcast('provision', { id: meta.id, status: 'error', msg: meta.provision.error });
    }
    broadcast('servers', {});
  })();
}));

// ---- mapa en vivo (BlueMap) ----
app.get('/api/servers/:id/map/status', asyncRoute(async (req, res) => {
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  const installed = await isBlueMapInstalled(meta);
  const online = runtimeOf(meta.id).status === 'online';
  const port = mapPortFor(meta);
  res.json({ supported: supportsContent(meta.loader), installed, online, port, reachable: installed && online ? await blueMapReachable(port) : false });
}));
app.post('/api/servers/:id/map/install', asyncRoute(async (req, res) => {
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  const installed = await installBlueMap(meta);
  await audit('map', `Instaló BlueMap en ${meta.name}`, 'ok');
  res.status(201).json({ installed, needsRestart: runtimeOf(meta.id).status !== 'offline' });
}));
app.all('/api/servers/:id/map/view/*', asyncRoute(async (req, res) => {
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  proxyBlueMap(mapPortFor(meta), req, res, req.params[0] ?? '');
}));
app.get('/api/servers/:id/map/view', (req, res) => { res.redirect(`/api/servers/${req.params.id}/map/view/`); });

// ---- historial de conexiones ----
app.get('/api/servers/:id/players/history', asyncRoute(async (req, res) => {
  res.json(await playerHistory(req.params.id!, runtimeOf(req.params.id!).players));
}));

app.delete('/api/servers/:id', asyncRoute(async (req, res) => {
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  if (String(req.query.confirm ?? '') !== meta.name) {
    res.status(400).json({ error: 'Confirmación requerida: pasa ?confirm=<nombre del servidor>' });
    return;
  }
  assertNotBusy(meta.id);
  await stopServer(meta.id);
  await forgetServer(meta.id); // suelta el puerto si estaba dormido
  await removeServer(meta.id);
  await removeEventsOfServer(meta.id);
  await rm(serverDir(meta.id), { recursive: true, force: true });
  await rm(path.join(BACKUPS_DIR, meta.id), { recursive: true, force: true });
  await audit('trash', `Eliminó el servidor ${meta.name}`, 'warn');
  broadcast('servers', {});
  res.json({ ok: true });
}));

app.delete('/api/servers/:id/world', asyncRoute(async (req, res) => {
  const id = req.params.id!;
  const meta = await getServer(id);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  if (String(req.query.confirm ?? '') !== meta.name) {
    res.status(400).json({ error: 'Confirmación requerida: pasa ?confirm=<nombre del servidor>' });
    return;
  }
  if (runtimeOf(id).status !== 'offline') { res.status(400).json({ error: 'Detén el servidor antes de borrar el mundo' }); return; }
  assertNotBusy(id);
  for (const d of ['world', 'world_nether', 'world_the_end']) {
    await rm(path.join(serverDir(id), d), { recursive: true, force: true });
  }
  await audit('trash', `Borró el mundo de ${meta.name}`, 'warn');
  res.json({ ok: true });
}));

// ---- whitelist ----
app.post('/api/servers/:id/whitelist', asyncRoute(async (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'Escribe el nick del jugador' }); return; }
  await whitelistAdd(req.params.id!, name.trim());
  res.status(201).json({ ok: true });
}));

app.delete('/api/servers/:id/whitelist/:name', asyncRoute(async (req, res) => {
  await whitelistRemove(req.params.id!, req.params.name!);
  res.json({ ok: true });
}));

// ---- rendimiento (RAM y núcleos, se aplica al reiniciar) ----
app.put('/api/servers/:id/settings', asyncRoute(async (req, res) => {
  const { memoryMb, cpuCores, autoRestart, autoStart, aikarFlags } = req.body as {
    memoryMb?: number; cpuCores?: number; autoRestart?: boolean; autoStart?: boolean; aikarFlags?: boolean;
  };
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  const patch: Partial<ServerMeta> = {};
  if (autoStart !== undefined) patch.autoStart = !!autoStart;
  if (aikarFlags !== undefined) patch.aikarFlags = !!aikarFlags;
  if (memoryMb !== undefined) {
    if (!Number.isInteger(memoryMb) || memoryMb < 1024 || memoryMb > 16384) { res.status(400).json({ error: 'RAM inválida (1–16 GB)' }); return; }
    patch.memoryMb = memoryMb;
  }
  if (cpuCores !== undefined) {
    const max = os.cpus().length;
    if (!Number.isInteger(cpuCores) || cpuCores < 0 || cpuCores > max) { res.status(400).json({ error: `Núcleos inválidos (0–${max})` }); return; }
    patch.cpuCores = cpuCores;
  }
  if (autoRestart !== undefined) patch.autoRestart = !!autoRestart;
  const { idleStopMinutes, wakeOnConnect } = req.body as { idleStopMinutes?: number; wakeOnConnect?: boolean };
  if (idleStopMinutes !== undefined) {
    if (!Number.isInteger(idleStopMinutes) || idleStopMinutes < 0 || idleStopMinutes > 1440) { res.status(400).json({ error: 'Minutos de inactividad inválidos (0–1440)' }); return; }
    patch.idleStopMinutes = idleStopMinutes;
  }
  if (wakeOnConnect !== undefined) patch.wakeOnConnect = !!wakeOnConnect;
  await updateServer(meta.id, patch);
  const bits = [];
  if (patch.memoryMb) bits.push(`${(patch.memoryMb / 1024).toFixed(0)} GB de RAM`);
  if (patch.cpuCores !== undefined) bits.push(patch.cpuCores === 0 ? 'todos los núcleos' : `${patch.cpuCores} núcleos`);
  if (patch.autoRestart !== undefined) bits.push(patch.autoRestart ? 'auto-reinicio tras crash activado' : 'auto-reinicio tras crash desactivado');
  if (patch.idleStopMinutes !== undefined) bits.push(patch.idleStopMinutes ? `se duerme tras ${patch.idleStopMinutes} min sin nadie` : 'nunca se duerme');
  if (patch.wakeOnConnect !== undefined) bits.push(patch.wakeOnConnect ? 'se despierta al conectar' : 'no se despierta al conectar');
  if (patch.autoStart !== undefined) bits.push(patch.autoStart ? 'arranque automático con el Umbrel activado' : 'arranque automático con el Umbrel desactivado');
  if (patch.aikarFlags !== undefined) bits.push(patch.aikarFlags ? 'flags de Aikar activados' : 'flags de Aikar desactivados');
  if (bits.length) await audit('cpu', `Ajustó el rendimiento de ${meta.name}: ${bits.join(', ')}`, 'info');
  res.json({ ok: true, needsRestart: runtimeOf(meta.id).status !== 'offline' });
}));

// ---- server.properties ----
app.get('/api/servers/:id/properties', asyncRoute(async (req, res) => {
  res.json(await readProperties(req.params.id!));
}));

// props que vanilla permite cambiar en caliente con comandos
const LIVE_APPLY: Record<string, (v: string) => string[]> = {
  difficulty: (v) => [`difficulty ${v}`],
  gamemode: (v) => [`defaultgamemode ${v}`],
  'white-list': (v) => [v === 'true' ? 'whitelist on' : 'whitelist off'],
};
const PROP_LABELS: Record<string, string> = {
  difficulty: 'Dificultad', gamemode: 'Modo de juego', 'white-list': 'Whitelist', motd: 'MOTD',
  'max-players': 'Máximo de jugadores', 'view-distance': 'Distancia de renderizado',
  'spawn-protection': 'Protección del spawn', pvp: 'PvP', hardcore: 'Hardcore',
  'generate-structures': 'Generar estructuras', 'spawn-monsters': 'Mobs hostiles', 'level-seed': 'Semilla',
  'online-mode': 'Solo cuentas premium', 'enforce-whitelist': 'Whitelist estricta',
};
const VALUE_LABELS: Record<string, string> = {
  peaceful: 'Pacífico', easy: 'Fácil', normal: 'Normal', hard: 'Difícil',
  survival: 'Supervivencia', creative: 'Creativo', adventure: 'Aventura', spectator: 'Espectador',
  true: 'activado', false: 'desactivado',
};

app.put('/api/servers/:id/properties', asyncRoute(async (req, res) => {
  const id = req.params.id!;
  const patch = req.body as Record<string, unknown>;
  if (!patch || typeof patch !== 'object') { res.status(400).json({ error: 'Body inválido' }); return; }
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(patch)) {
    // el MOTD admite salto de línea: Minecraft lo guarda como "\n" literal en el properties
    const val = k === 'motd' ? String(v).replace(/\r?\n/g, '\\n') : String(v);
    if (!/^[a-z0-9.-]+$/i.test(k) || /[\r\n]/.test(val)) { res.status(400).json({ error: `Clave o valor inválido: ${k}` }); return; }
    clean[k] = val;
  }
  const before = await readProperties(id);
  const changed = Object.entries(clean).filter(([k, v]) => (before[k] ?? '') !== v);
  await writeProperties(id, clean);

  const online = runtimeOf(id).status === 'online';
  const appliedLive: string[] = [];
  const needsRestart: string[] = [];
  for (const [k, v] of changed) {
    const label = PROP_LABELS[k] ?? k;
    const vLabel = VALUE_LABELS[v] ?? v;
    if (online && LIVE_APPLY[k]) {
      for (const cmd of LIVE_APPLY[k]!(v)) sendCommand(id, cmd);
      announceInGame(id, `${label}: ahora ${vLabel}`);
      appliedLive.push(`${label} → ${vLabel}`);
    } else if (online) {
      needsRestart.push(label);
    }
  }
  if (changed.length) await audit('save', `Modificó server.properties (${changed.map(([k]) => PROP_LABELS[k] ?? k).join(', ')})`, 'info');
  res.json({ ok: true, online, appliedLive, needsRestart });
}));

app.post('/api/servers/:id/gamerule', asyncRoute(async (req, res) => {
  const { rule, value, label } = req.body as { rule?: string; value?: boolean; label?: string };
  if (!rule || !/^[A-Za-z]+$/.test(rule) || typeof value !== 'boolean') { res.status(400).json({ error: 'Regla inválida' }); return; }
  sendCommand(req.params.id!, `gamerule ${rule} ${value}`);
  announceInGame(req.params.id!, `${label && /^[\wÁÉÍÓÚáéíóúñÑ /]+$/.test(label) ? label : rule} ${value ? 'activado' : 'desactivado'}`);
  await audit('save', `Cambió la regla ${rule} a ${value}`, 'info');
  res.json({ ok: true });
}));

// ---- mods (Modrinth) ----
app.get('/api/servers/:id/mods', asyncRoute(async (req, res) => {
  // completa iconos y lado cliente/servidor de los mods antiguos (una consulta, solo si falta algo)
  await ensureSideInfo(req.params.id!).catch(() => {});
  res.json({ installed: await listMods(req.params.id!) });
}));

app.post('/api/servers/:id/mods', asyncRoute(async (req, res) => {
  const { project } = req.body as { project?: string };
  if (!project || !/^[\w-]+$/.test(project)) { res.status(400).json({ error: 'Proyecto inválido' }); return; }
  const installed = await installMod(req.params.id!, project);
  res.status(201).json({ installed });
}));

app.delete('/api/servers/:id/mods/:filename', asyncRoute(async (req, res) => {
  await removeMod(req.params.id!, req.params.filename!);
  res.json({ ok: true });
}));

app.post('/api/servers/:id/mods/:filename/toggle', asyncRoute(async (req, res) => {
  const { enabled } = req.body as { enabled?: boolean };
  await toggleMod(req.params.id!, req.params.filename!, !!enabled);
  res.json({ ok: true });
}));

app.get('/api/servers/:id/mods/pack', asyncRoute(async (req, res) => {
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  // por defecto solo lo que hace falta para entrar; ?all=1 mete también los opcionales de cliente
  const pack = await clientPack(meta.id);
  const chosen = req.query.all === '1' ? [...pack.needed, ...pack.optional] : pack.needed;
  if (!chosen.length) { res.status(400).json({ error: 'No hay mods que tus amigos necesiten instalar' }); return; }
  const dir = await contentDir(meta.id);
  res.attachment(`craftdeck-${meta.name.replace(/[^\w-]+/g, '_')}-mods.zip`);
  const archive = createZip();
  archive.on('error', (err) => res.destroy(err));
  archive.pipe(res);
  for (const m of chosen) archive.file(path.join(dir, m.filename), { name: m.filename });
  archive.append([
    `Mods para jugar en «${meta.name}» (${meta.loader} ${meta.mcVersion})`,
    '',
    `1. Instala ${meta.loader === 'fabric' ? 'Fabric' : meta.loader === 'neoforge' ? 'NeoForge' : 'Forge'} para Minecraft ${meta.mcVersion} en tu launcher.`,
    '2. Copia estos .jar en la carpeta mods de tu Minecraft (.minecraft/mods).',
    '3. Arranca el juego con ese perfil y entra al servidor.',
    '',
    `Incluidos (${chosen.length}):`, ...chosen.map((m) => `  - ${m.name} (${m.filename})${pack.unknown.includes(m) ? '  [subido a mano: no sé si hace falta en cliente]' : pack.deps.includes(m) ? '  [dependencia de otro mod]' : pack.optional.includes(m) ? '  [opcional: no hace falta para entrar]' : ''}`),
    ...(req.query.all === '1' || !pack.optional.length ? [] : ['', `Opcionales, no hacen falta para entrar (${pack.optional.length}):`, ...pack.optional.map((m) => `  - ${m.name}`)]),
    ...(pack.serverOnly.length ? ['', `Solo de servidor, no sirven en tu PC (${pack.serverOnly.length}):`, ...pack.serverOnly.map((m) => `  - ${m.name}`)] : []),
    '', 'Generado por CraftDeck.', '',
  ].join('\n'), { name: 'LEEME.txt' });
  await archive.finalize();
  await audit('download', `Exportó el pack de mods para amigos (${chosen.length} jars, ${pack.serverOnly.length} solo de servidor fuera)`, 'info');
}));

// qué entra y qué se queda fuera del pack de amigos (para enseñarlo antes de descargar)
app.get('/api/servers/:id/mods/pack/preview', asyncRoute(async (req, res) => {
  const pack = await clientPack(req.params.id!);
  const names = (l: typeof pack.needed) => l.map((m) => m.name);
  res.json({ needed: names(pack.needed), optional: names(pack.optional), serverOnly: names(pack.serverOnly), unknown: names(pack.unknown), deps: names(pack.deps) });
}));

// pack de amigos en .mrpack: lo importan Prism, Modrinth App, ATLauncher…
app.get('/api/servers/:id/mods/pack.mrpack', asyncRoute(async (req, res) => {
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  if (!supportsContent(meta.loader) || meta.loader === 'paper') { res.status(400).json({ error: 'El .mrpack es para servidores con mods (los plugins de Paper no van en el cliente)' }); return; }
  res.attachment(`craftdeck-${meta.name.replace(/[^\w-]+/g, '_')}.mrpack`);
  res.on('error', () => res.destroy());
  const n = await writeMrpack(meta, res);
  await audit('download', `Exportó el pack de amigos en .mrpack (${n} mods)`, 'info');
}));

app.get('/api/servers/:id/mods/updates', asyncRoute(async (req, res) => {
  res.json({ updates: await checkModUpdates(req.params.id!) });
}));

app.post('/api/servers/:id/mods/:filename/update', asyncRoute(async (req, res) => {
  res.json({ version: await updateMod(req.params.id!, req.params.filename!) });
}));

// ---- estadísticas y diagnóstico ----
app.get('/api/servers/:id/stats', asyncRoute(async (req, res) => {
  res.json({ players: await playerStats(req.params.id!) });
}));

app.get('/api/servers/:id/crashes', asyncRoute(async (req, res) => {
  res.json({ crashes: await listCrashes(req.params.id!) });
}));

app.get('/api/servers/:id/crashes/:file', asyncRoute(async (req, res) => {
  res.json({ text: await crashText(req.params.id!, req.params.file!) });
}));

// ---- editor de archivos ----
app.get('/api/servers/:id/files', asyncRoute(async (req, res) => {
  res.json({ files: await listEditableFiles(req.params.id!) });
}));

app.get('/api/servers/:id/file', asyncRoute(async (req, res) => {
  const rel = String(req.query.path ?? '');
  res.json({ path: rel, content: await readEditableFile(req.params.id!, rel) });
}));

app.put('/api/servers/:id/file', asyncRoute(async (req, res) => {
  const { path: rel, content } = req.body as { path?: string; content?: string };
  if (!rel || typeof content !== 'string') { res.status(400).json({ error: 'Faltan path o content' }); return; }
  await writeEditableFile(req.params.id!, rel, content);
  await audit('save', `Editó ${rel}`, 'info');
  res.json({ ok: true });
}));

// ---- backups ----
app.get('/api/servers/:id/backups', asyncRoute(async (req, res) => {
  res.json(await listBackups(req.params.id!));
}));

app.post('/api/servers/:id/backups', asyncRoute(async (req, res) => {
  res.status(201).json(await makeBackup(req.params.id!));
}));

app.post('/api/servers/:id/backups/:name/restore', asyncRoute(async (req, res) => {
  const { mode } = (req.body ?? {}) as { mode?: string };
  await restoreBackup(req.params.id!, req.params.name!, mode === 'all' ? 'all' : 'world');
  res.json({ ok: true });
}));

app.delete('/api/servers/:id/backups/:name', asyncRoute(async (req, res) => {
  await deleteBackup(req.params.id!, req.params.name!);
  res.json({ ok: true });
}));

app.get('/api/servers/:id/backups/:name/download', asyncRoute(async (req, res) => {
  res.download(backupFilePath(req.params.id!, req.params.name!));
}));

app.put('/api/servers/:id/backup-settings', asyncRoute(async (req, res) => {
  const { auto, keep, time, days } = req.body as { auto?: boolean; keep?: number; time?: string; days?: number[] };
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  if (keep !== undefined && (!Number.isInteger(keep) || keep < 1 || keep > 30)) { res.status(400).json({ error: 'Conserva entre 1 y 30 copias' }); return; }
  if (time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) { res.status(400).json({ error: 'Hora inválida (HH:MM)' }); return; }
  if (days !== undefined && (!Array.isArray(days) || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6))) { res.status(400).json({ error: 'Días inválidos' }); return; }
  await updateServer(meta.id, {
    backupAuto: auto ?? meta.backupAuto,
    backupKeep: keep ?? meta.backupKeep,
    backupTime: time ?? meta.backupTime,
    backupDays: days !== undefined ? (days.length === 7 || days.length === 0 ? undefined : days) : meta.backupDays,
  });
  if (time !== undefined || days !== undefined) {
    const s = backupSchedule(await getServer(meta.id) ?? meta);
    await audit('database', `Backup automático de ${meta.name}: a las ${s.time}${s.days.length === 7 ? ' todos los días' : ' los días ' + s.days.join(',')}`, 'info');
  }
  // si se baja el número, las copias automáticas que sobran se borran ya, sin esperar a las 04:00
  const pruned = keep !== undefined ? await pruneAuto(meta.id, keep) : 0;
  if (keep !== undefined) await audit('database', `Backups automáticos de ${meta.name}: conservar los últimos ${keep}${pruned ? ` (borradas ${pruned} copias antiguas)` : ''}`, 'info');
  res.json({ ok: true, pruned });
}));

// ---- dirección pública (dominio/IP y puerto con los que entran los amigos desde fuera) ----
app.put('/api/servers/:id/address', asyncRoute(async (req, res) => {
  const { publicAddress } = req.body as { publicAddress?: string };
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  const addr = (publicAddress ?? '').trim();
  // host (dominio o IP) con puerto opcional; nada de espacios, esquemas ni rutas
  if (addr && !/^[A-Za-z0-9.-]{1,253}(:\d{1,5})?$/.test(addr)) { res.status(400).json({ error: 'Escribe solo dominio-o-IP:puerto, por ejemplo micasa.freeboxos.fr:49152' }); return; }
  await updateServer(meta.id, { publicAddress: addr || undefined });
  await audit('link', addr ? `Dirección pública de ${meta.name}: ${addr}` : `Quitó la dirección pública de ${meta.name}`, 'info');
  res.json({ ok: true });
}));

// ---- eventos programados ----
const EVENT_TYPES: EventType[] = ['restart', 'announce', 'command', 'start', 'stop'];

app.get('/api/servers/:id/events', asyncRoute(async (req, res) => {
  res.json({ events: await listEvents(req.params.id!) });
}));

app.post('/api/servers/:id/events', asyncRoute(async (req, res) => {
  const { type, payload, schedule } = req.body as { type?: EventType; payload?: string; schedule?: Schedule };
  if (!type || !EVENT_TYPES.includes(type)) { res.status(400).json({ error: 'Tipo de tarea inválido' }); return; }
  if ((type === 'announce' || type === 'command') && !payload?.trim()) {
    res.status(400).json({ error: type === 'announce' ? 'Escribe el mensaje del anuncio' : 'Escribe el comando' });
    return;
  }
  if (!schedule || !['daily', 'weekly', 'interval'].includes(schedule.kind)) { res.status(400).json({ error: 'Horario inválido' }); return; }
  if (payload && /[\r\n]/.test(payload)) { res.status(400).json({ error: 'Contenido inválido' }); return; }
  res.status(201).json(await addEvent(req.params.id!, type, (payload ?? '').trim(), schedule));
}));

app.post('/api/servers/:id/events/:tid/toggle', asyncRoute(async (req, res) => {
  const { enabled } = req.body as { enabled?: boolean };
  await toggleEvent(req.params.id!, req.params.tid!, !!enabled);
  res.json({ ok: true });
}));

app.delete('/api/servers/:id/events/:tid', asyncRoute(async (req, res) => {
  await deleteEvent(req.params.id!, req.params.tid!);
  res.json({ ok: true });
}));

// ---- integraciones ----
app.put('/api/servers/:id/discord', asyncRoute(async (req, res) => {
  const { url, onStatus, onPlayers, onBackup, chatMirror } = req.body as {
    url?: string; onStatus?: boolean; onPlayers?: boolean; onBackup?: boolean; chatMirror?: boolean;
  };
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  if (url && !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url)) {
    res.status(400).json({ error: 'Eso no parece una URL de webhook de Discord' });
    return;
  }
  await updateServer(meta.id, {
    discord: url
      ? { url, onStatus: onStatus ?? true, onPlayers: onPlayers ?? true, onBackup: onBackup ?? false, chatMirror: chatMirror ?? false }
      : undefined,
  });
  await audit('message', url ? 'Configuró la integración con Discord' : 'Desconectó Discord', 'info');
  res.json({ ok: true });
}));

app.post('/api/servers/:id/discord/test', asyncRoute(async (req, res) => {
  const meta = await getServer(req.params.id!);
  if (!meta?.discord?.url) { res.status(400).json({ error: 'Configura primero el webhook' }); return; }
  await testWebhook(meta.discord.url);
  res.json({ ok: true });
}));

app.get('/api/playit', asyncRoute(async (_req, res) => {
  res.json(playitStatus());
}));

app.post('/api/playit/start', asyncRoute(async (_req, res) => {
  await startPlayit();
  res.json({ ok: true });
}));

app.post('/api/playit/stop', asyncRoute(async (_req, res) => {
  await stopPlayit();
  res.json({ ok: true });
}));

app.put('/api/playit/settings', asyncRoute(async (req, res) => {
  const { autoStart } = req.body as { autoStart?: boolean };
  if (typeof autoStart !== 'boolean') { res.status(400).json({ error: 'Falta autoStart' }); return; }
  await setPlayitAutoStart(autoStart);
  res.json({ ok: true });
}));

// ---- auditoría ----
app.get('/api/audit', asyncRoute(async (_req, res) => {
  res.json(await readAudit());
}));

app.use(express.static(FRONTEND_DIR));

setBroadcast(broadcast);
setBackupBroadcast(broadcast);
setPlayitBroadcast(broadcast);
scheduleAutoBackups();
void initEvents();

httpServer.listen(PORT, () => {
  console.log(`[craftdeck] panel en http://localhost:${PORT}`);
  // tras un reinicio del Umbrel o una actualización: levantar lo que estaba encendido
  void initPlayit();
  void autoStartServers();
});

// parada limpia: detener los servidores antes de salir
// (el fallback debe superar la escalada de stopServer —75 s— y quedar por debajo
// del stop_grace_period del compose, 90 s)
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void stopAll().then(() => process.exit(0));
    setTimeout(() => process.exit(0), 80_000).unref();
  });
}

// error fatal: intentar guardar los mundos antes de morir, que el contenedor nos reinicia
process.on('uncaughtException', (err) => {
  console.error('[craftdeck] error fatal:', err);
  void stopAll().finally(() => process.exit(1));
  setTimeout(() => process.exit(1), 80_000).unref();
});
process.on('unhandledRejection', (err) => {
  console.error('[craftdeck] promesa rechazada sin capturar:', err);
});
