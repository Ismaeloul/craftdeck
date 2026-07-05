import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { rm } from 'node:fs/promises';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { FRONTEND_DIR, BACKUPS_DIR, APP_VERSION } from './paths.js';
import { listVanillaVersions } from './catalog/vanilla.js';
import { listFabricGameVersions } from './catalog/fabric.js';
import { listForgeVersions } from './catalog/forge.js';
import { listNeoForgeVersions } from './catalog/neoforge.js';
import { provisionServer } from './provision.js';
import {
  setBroadcast, runtimeOf, consoleOf, startServer, stopServer, sendCommand, stopAll, announceInGame,
} from './instance.js';
import { playerLists, playerAction, whitelistAdd, whitelistRemove } from './players.js';
import {
  listBackups, makeBackup, restoreBackup, deleteBackup, backupFilePath,
  scheduleAutoBackups, setBackupBroadcast,
} from './backups.js';
import {
  readProperties, writeProperties, listEditableFiles, readEditableFile, writeEditableFile,
} from './properties.js';
import { listMods, installMod, removeMod, toggleMod, checkModUpdates, updateMod, enabledModJarPaths } from './mods.js';
import { createZip } from './backups.js';
import { playerStats } from './stats.js';
import { listCrashes, crashText } from './crashes.js';
import {
  listEvents, addEvent, toggleEvent, deleteEvent, removeEventsOfServer, initEvents, EventType, Schedule,
} from './events.js';
import { testWebhook } from './discord.js';
import { playitStatus, startPlayit, stopPlayit, setPlayitBroadcast } from './playit.js';
import {
  Loader, ServerMeta, listServers, getServer, addServer, removeServer, updateServer,
  serverDir, nextFreePort, audit, readAudit,
} from './store.js';

const PORT = Number(process.env.PORT ?? 8449);
const LOADERS: Loader[] = ['vanilla', 'fabric', 'forge', 'neoforge'];

const app = express();
app.use(express.json());

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

// ---- catálogo de versiones ----
app.get('/api/catalog/:loader', asyncRoute(async (req, res) => {
  const loader = req.params.loader as Loader;
  switch (loader) {
    case 'vanilla':
      res.json({ loader, versions: (await listVanillaVersions()).map((v) => v.id) });
      return;
    case 'fabric':
      res.json({ loader, versions: await listFabricGameVersions() });
      return;
    case 'forge':
      res.json({ loader, versions: (await listForgeVersions()).map((v) => v.mc) });
      return;
    case 'neoforge':
      res.json({ loader, versions: (await listNeoForgeVersions()).map((v) => v.mc) });
      return;
    default:
      res.status(400).json({ error: `Loader desconocido: ${String(loader)}` });
  }
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
  res.json({ lines: consoleOf(req.params.id!) });
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
  const { name, loader, version, memoryMb, acceptEula } = req.body as {
    name?: string; loader?: Loader; version?: string; memoryMb?: number; acceptEula?: boolean;
  };
  if (!name?.trim()) { res.status(400).json({ error: 'Falta el nombre del servidor' }); return; }
  if (!loader || !LOADERS.includes(loader)) { res.status(400).json({ error: 'Loader inválido' }); return; }
  if (!version) { res.status(400).json({ error: 'Falta la versión de Minecraft' }); return; }
  if (!acceptEula) { res.status(400).json({ error: 'Debes aceptar la EULA de Mojang' }); return; }

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
  };
  await addServer(meta);
  void provisionServer(meta, broadcast); // continúa en segundo plano
  res.status(201).json(meta);
}));

app.delete('/api/servers/:id', asyncRoute(async (req, res) => {
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  if (String(req.query.confirm ?? '') !== meta.name) {
    res.status(400).json({ error: 'Confirmación requerida: pasa ?confirm=<nombre del servidor>' });
    return;
  }
  await stopServer(meta.id);
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
  const { memoryMb, cpuCores } = req.body as { memoryMb?: number; cpuCores?: number };
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  const patch: Partial<ServerMeta> = {};
  if (memoryMb !== undefined) {
    if (!Number.isInteger(memoryMb) || memoryMb < 1024 || memoryMb > 16384) { res.status(400).json({ error: 'RAM inválida (1–16 GB)' }); return; }
    patch.memoryMb = memoryMb;
  }
  if (cpuCores !== undefined) {
    const max = os.cpus().length;
    if (!Number.isInteger(cpuCores) || cpuCores < 0 || cpuCores > max) { res.status(400).json({ error: `Núcleos inválidos (0–${max})` }); return; }
    patch.cpuCores = cpuCores;
  }
  await updateServer(meta.id, patch);
  const bits = [];
  if (patch.memoryMb) bits.push(`${(patch.memoryMb / 1024).toFixed(0)} GB de RAM`);
  if (patch.cpuCores !== undefined) bits.push(patch.cpuCores === 0 ? 'todos los núcleos' : `${patch.cpuCores} núcleos`);
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
    if (!/^[a-z0-9.-]+$/i.test(k) || /[\r\n]/.test(String(v))) { res.status(400).json({ error: `Clave o valor inválido: ${k}` }); return; }
    clean[k] = String(v);
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
  const files = await enabledModJarPaths(meta.id);
  if (!files.length) { res.status(400).json({ error: 'No hay mods activos que empaquetar' }); return; }
  res.attachment(`craftdeck-${meta.name.replace(/[^\w-]+/g, '_')}-mods.zip`);
  const archive = createZip();
  archive.on('error', (err) => res.destroy(err));
  archive.pipe(res);
  for (const f of files) archive.file(f, { name: path.basename(f) });
  await archive.finalize();
  await audit('download', `Exportó el pack de mods (${files.length} jars)`, 'info');
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
  await restoreBackup(req.params.id!, req.params.name!);
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
  const { auto, keep } = req.body as { auto?: boolean; keep?: number };
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  await updateServer(meta.id, {
    backupAuto: auto ?? meta.backupAuto,
    backupKeep: keep !== undefined ? Math.min(Math.max(keep, 1), 30) : meta.backupKeep,
  });
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
});

// parada limpia: detener los servidores antes de salir
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void stopAll().then(() => process.exit(0));
    setTimeout(() => process.exit(0), 35_000).unref();
  });
}
