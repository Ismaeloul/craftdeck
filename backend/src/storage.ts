import { readdir, stat, statfs } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, SERVERS_DIR, BACKUPS_DIR, RUNTIMES_DIR, CACHE_DIR } from './paths.js';
import { listServers } from './store.js';

/** Tamaño de un directorio (recursivo). Los mundos grandes tardan un poco: se cachea un minuto. */
async function dirSize(dir: string): Promise<number> {
  let total = 0;
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += await dirSize(p);
    else if (e.isFile()) { try { total += (await stat(p)).size; } catch { /* borrado a medio contar */ } }
  }
  return total;
}

export interface StorageInfo {
  totalMb: number;
  diskFreeMb: number | null;
  diskTotalMb: number | null;
  runtimesMb: number;
  cacheMb: number;
  servers: { id: string; name: string; serverMb: number; worldMb: number; backupsMb: number }[];
}

let cache: { at: number; data: StorageInfo } | null = null;

export async function storageInfo(force = false): Promise<StorageInfo> {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache.data;
  const toMb = (b: number) => Math.round(b / 1048576);
  const servers = [];
  for (const meta of await listServers()) {
    const dir = path.join(SERVERS_DIR, meta.id);
    const [serverB, worldB, backupsB] = await Promise.all([
      dirSize(dir), dirSize(path.join(dir, 'world')), dirSize(path.join(BACKUPS_DIR, meta.id)),
    ]);
    servers.push({ id: meta.id, name: meta.name, serverMb: toMb(serverB), worldMb: toMb(worldB), backupsMb: toMb(backupsB) });
  }
  const [runtimesB, cacheB] = await Promise.all([dirSize(RUNTIMES_DIR), dirSize(CACHE_DIR)]);
  let diskFreeMb: number | null = null, diskTotalMb: number | null = null;
  try {
    const fs = await statfs(DATA_DIR);
    diskFreeMb = toMb(fs.bavail * fs.bsize);
    diskTotalMb = toMb(fs.blocks * fs.bsize);
  } catch { /* sin statfs */ }
  const data: StorageInfo = {
    totalMb: servers.reduce((a, s) => a + s.serverMb + s.backupsMb, 0) + toMb(runtimesB) + toMb(cacheB),
    diskFreeMb, diskTotalMb, runtimesMb: toMb(runtimesB), cacheMb: toMb(cacheB), servers,
  };
  cache = { at: Date.now(), data };
  return data;
}
