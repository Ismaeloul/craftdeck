import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { rm } from 'node:fs/promises';
import crypto from 'node:crypto';
import { FRONTEND_DIR } from './paths.js';
import { listVanillaVersions } from './catalog/vanilla.js';
import { listFabricGameVersions } from './catalog/fabric.js';
import { listForgeVersions } from './catalog/forge.js';
import { listNeoForgeVersions } from './catalog/neoforge.js';
import { provisionServer } from './provision.js';
import {
  Loader, ServerMeta, listServers, getServer, addServer, removeServer,
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
  res.json({ ok: true, name: 'craftdeck', version: '0.1.0' });
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
  res.json(await listServers());
}));

app.get('/api/servers/:id', asyncRoute(async (req, res) => {
  const meta = await getServer(req.params.id!);
  if (!meta) { res.status(404).json({ error: 'Servidor no encontrado' }); return; }
  res.json(meta);
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
  await removeServer(meta.id);
  await rm(serverDir(meta.id), { recursive: true, force: true });
  await audit('trash', `Eliminó el servidor ${meta.name}`, 'warn');
  broadcast('servers', {});
  res.json({ ok: true });
}));

// ---- auditoría ----
app.get('/api/audit', asyncRoute(async (_req, res) => {
  res.json(await readAudit());
}));

app.use(express.static(FRONTEND_DIR));

httpServer.listen(PORT, () => {
  console.log(`[craftdeck] panel en http://localhost:${PORT}`);
});
