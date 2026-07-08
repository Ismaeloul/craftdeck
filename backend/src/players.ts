import { readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { writeFileAtomic } from './util.js';
import { serverDir, audit } from './store.js';
import { sendCommand, runtimeOf } from './instance.js';
import { readProperties } from './properties.js';

const NAME_RE = /^[A-Za-z0-9_]{1,16}$/;

async function readJsonList(id: string, file: string): Promise<Record<string, string>[]> {
  try {
    return JSON.parse(await readFile(path.join(serverDir(id), file), 'utf8'));
  } catch {
    return [];
  }
}

export async function playerLists(id: string): Promise<{
  ops: string[]; whitelist: string[]; banned: { name: string; reason?: string }[];
}> {
  const [ops, whitelist, banned] = await Promise.all([
    readJsonList(id, 'ops.json'),
    readJsonList(id, 'whitelist.json'),
    readJsonList(id, 'banned-players.json'),
  ]);
  return {
    ops: ops.map((o) => o.name!),
    whitelist: whitelist.map((w) => w.name!),
    banned: banned.map((b) => ({ name: b.name!, reason: b.reason })),
  };
}

const ACTIONS: Record<string, { cmd: (name: string, reason?: string) => string; audit: string; level: 'info' | 'warn' | 'err' }> = {
  kick: { cmd: (n, r) => `kick ${n}${r ? ' ' + r : ''}`, audit: 'Expulsó a', level: 'warn' },
  ban: { cmd: (n, r) => `ban ${n}${r ? ' ' + r : ''}`, audit: 'Baneó a', level: 'err' },
  pardon: { cmd: (n) => `pardon ${n}`, audit: 'Quitó el ban a', level: 'info' },
  op: { cmd: (n) => `op ${n}`, audit: 'Dio OP a', level: 'warn' },
  deop: { cmd: (n) => `deop ${n}`, audit: 'Quitó OP a', level: 'warn' },
  'whitelist-add': { cmd: (n) => `whitelist add ${n}`, audit: 'Añadió a la whitelist a', level: 'info' },
  'whitelist-remove': { cmd: (n) => `whitelist remove ${n}`, audit: 'Quitó de la whitelist a', level: 'info' },
};

/** UUID que usa Minecraft en modo no premium: v3 (md5) de "OfflinePlayer:"+nick. */
function offlineUuid(name: string): string {
  const hash = crypto.createHash('md5').update(`OfflinePlayer:${name}`, 'utf8').digest();
  hash[6] = (hash[6]! & 0x0f) | 0x30;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function premiumUuid(name: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const { id } = await res.json() as { id?: string };
    if (!id) return null;
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  } catch {
    return null;
  }
}

async function editWhitelistFile(id: string, mutate: (list: Record<string, string>[]) => Record<string, string>[]): Promise<void> {
  const list = await readJsonList(id, 'whitelist.json');
  await writeFileAtomic(path.join(serverDir(id), 'whitelist.json'), JSON.stringify(mutate(list), null, 2));
}

export async function whitelistAdd(id: string, name: string): Promise<void> {
  if (!NAME_RE.test(name)) throw new Error('Nombre de jugador inválido');
  if (runtimeOf(id).status === 'online') {
    sendCommand(id, `whitelist add ${name}`);
  } else {
    const premium = (await readProperties(id))['online-mode'] !== 'false';
    const uuid = premium ? await premiumUuid(name) : offlineUuid(name);
    if (!uuid) throw new Error(`No existe ninguna cuenta premium llamada «${name}». Si tu server es no premium, el nick se añadirá con su UUID offline.`);
    await editWhitelistFile(id, (list) =>
      list.some((w) => w.name?.toLowerCase() === name.toLowerCase()) ? list : [...list, { uuid, name }]);
  }
  await audit('shield', `Añadió a ${name} a la whitelist`, 'info');
}

export async function whitelistRemove(id: string, name: string): Promise<void> {
  if (!NAME_RE.test(name)) throw new Error('Nombre de jugador inválido');
  if (runtimeOf(id).status === 'online') {
    sendCommand(id, `whitelist remove ${name}`);
  } else {
    await editWhitelistFile(id, (list) => list.filter((w) => w.name?.toLowerCase() !== name.toLowerCase()));
  }
  await audit('shield', `Quitó a ${name} de la whitelist`, 'warn');
}

export async function playerAction(id: string, action: string, name: string, reason?: string): Promise<void> {
  const spec = ACTIONS[action];
  if (!spec) throw new Error(`Acción desconocida: ${action}`);
  if (!NAME_RE.test(name)) throw new Error('Nombre de jugador inválido');
  if (reason && /[\r\n]/.test(reason)) throw new Error('Razón inválida');
  sendCommand(id, spec.cmd(name, reason));
  await audit(action === 'ban' ? 'ban' : action === 'kick' ? 'logout' : 'crown', `${spec.audit} ${name}`, spec.level);
}
