import { readFile, mkdir, appendFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, SERVERS_DIR } from './paths.js';
import { writeFileAtomic } from './util.js';

export type Loader = 'vanilla' | 'fabric' | 'forge' | 'neoforge';

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
