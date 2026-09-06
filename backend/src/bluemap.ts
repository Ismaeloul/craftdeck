import { mkdir, readdir, readFile, writeFile, access } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import type { Request, Response } from 'express';
import { ServerMeta, serverDir, updateServer, contentDirName, supportsContent } from './store.js';
import { installMod } from './mods.js';

/**
 * Mapa en vivo con BlueMap (mod para Fabric/Forge/NeoForge, plugin para Paper).
 * CraftDeck lo instala desde Modrinth, le deja la configuración hecha (aceptar la
 * descarga de recursos de Mojang y un puerto de webserver solo local) y hace de
 * proxy hacia su web, que se enseña dentro del panel.
 */
const BASE_PORT = 8100;

export function mapPortFor(meta: ServerMeta): number {
  return meta.mapPort ?? BASE_PORT + (meta.port - 25565);
}

/** Directorio de configuración de BlueMap según el tipo de servidor. */
function configDir(meta: ServerMeta): string {
  return meta.loader === 'paper'
    ? path.join(serverDir(meta.id), 'plugins', 'BlueMap')
    : path.join(serverDir(meta.id), 'config', 'bluemap');
}

export async function isBlueMapInstalled(meta: ServerMeta): Promise<boolean> {
  if (!supportsContent(meta.loader)) return false;
  try {
    const files = await readdir(path.join(serverDir(meta.id), contentDirName(meta.loader)));
    return files.some((f) => /^bluemap.*\.jar$/i.test(f));
  } catch {
    return false;
  }
}

/**
 * Escribe (o completa) core.conf y webserver.conf. BlueMap genera estos ficheros con
 * comentarios en el primer arranque; si ya existen, solo se tocan las claves que importan.
 */
export async function prepareBlueMapConfig(meta: ServerMeta): Promise<void> {
  if (!(await isBlueMapInstalled(meta))) return;
  const dir = configDir(meta);
  await mkdir(dir, { recursive: true });
  const port = mapPortFor(meta);
  if (meta.mapPort !== port) await updateServer(meta.id, { mapPort: port });

  await upsertConf(path.join(dir, 'core.conf'), { 'accept-download': 'true' },
    '# Generado por CraftDeck: acepta la descarga de recursos de Mojang que BlueMap necesita para renderizar.\naccept-download: true\n');
  await upsertConf(path.join(dir, 'webserver.conf'), { enabled: 'true', ip: '"127.0.0.1"', port: String(port) },
    `# Generado por CraftDeck: el mapa se sirve solo dentro del contenedor y el panel hace de proxy.\nenabled: true\nip: "127.0.0.1"\nport: ${port}\n`);
}

async function upsertConf(file: string, keys: Record<string, string>, fresh: string): Promise<void> {
  let text: string;
  try { text = await readFile(file, 'utf8'); } catch { await writeFile(file, fresh); return; }
  for (const [k, v] of Object.entries(keys)) {
    const re = new RegExp(`^(\\s*)${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:.*$`, 'm');
    text = re.test(text) ? text.replace(re, `$1${k}: ${v}`) : `${text.replace(/\s*$/, '')}\n${k}: ${v}\n`;
  }
  await writeFile(file, text);
}

export async function installBlueMap(meta: ServerMeta): Promise<string[]> {
  if (!supportsContent(meta.loader)) throw new Error('El mapa en vivo necesita un servidor Paper, Fabric, Forge o NeoForge (vanilla no admite mods).');
  const installed = await installMod(meta.id, 'bluemap');
  await prepareBlueMapConfig(meta);
  return installed;
}

/** ¿Responde ya el webserver de BlueMap? (tarda un poco tras arrancar el servidor) */
export function blueMapReachable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/settings.json', timeout: 1500 }, (res) => {
      res.resume();
      resolve((res.statusCode ?? 500) < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

/** Proxy transparente: /api/servers/:id/map/<ruta> → http://127.0.0.1:<port>/<ruta> */
export function proxyBlueMap(port: number, req: Request, res: Response, rest: string): void {
  const target = '/' + rest.replace(/^\/+/, '') + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
  const upstream = http.request({
    host: '127.0.0.1', port, path: target, method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${port}` },
  }, (up) => {
    res.status(up.statusCode ?? 502);
    for (const [k, v] of Object.entries(up.headers)) if (v !== undefined && k !== 'transfer-encoding') res.setHeader(k, v);
    up.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.status(503).json({ error: 'BlueMap todavía no responde: arranca el servidor y espera un minuto' });
    else res.end();
  });
  req.pipe(upstream);
}

export async function blueMapConfigExists(meta: ServerMeta): Promise<boolean> {
  try { await access(path.join(configDir(meta), 'webserver.conf')); return true; } catch { return false; }
}
