import { readFile, appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { serverDir } from './store.js';
import { writeFileAtomic } from './util.js';

/**
 * Historial de conexiones por servidor (quién entró y salió, y cuándo), en un
 * JSONL pequeño dentro del directorio del servidor. Lo alimenta instance.ts.
 */
export interface PlayerEvent { at: string; name: string; kind: 'join' | 'leave' }
export interface KnownPlayer { name: string; lastSeen: string; lastJoin: string | null; sessions: number; totalMinutes: number }

const MAX_LINES = 600;

function file(id: string): string { return path.join(serverDir(id), 'craftdeck-players.jsonl'); }

export async function recordPlayerEvent(id: string, name: string, kind: 'join' | 'leave'): Promise<void> {
  try {
    await mkdir(serverDir(id), { recursive: true });
    await appendFile(file(id), JSON.stringify({ at: new Date().toISOString(), name, kind } satisfies PlayerEvent) + '\n');
    const lines = (await readFile(file(id), 'utf8')).trim().split('\n');
    if (lines.length > MAX_LINES + 100) await writeFileAtomic(file(id), lines.slice(-MAX_LINES).join('\n') + '\n');
  } catch { /* best-effort */ }
}

export async function readPlayerEvents(id: string): Promise<PlayerEvent[]> {
  try {
    return (await readFile(file(id), 'utf8')).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as PlayerEvent);
  } catch {
    return [];
  }
}

/** Resumen por jugador: última vez visto, sesiones y tiempo total (aprox.) a partir de los eventos. */
export async function playerHistory(id: string, online: { name: string; joinedAt: number }[]): Promise<{ recent: PlayerEvent[]; players: KnownPlayer[] }> {
  const events = await readPlayerEvents(id);
  const map = new Map<string, KnownPlayer & { openJoin?: number }>();
  for (const e of events) {
    const p = map.get(e.name) ?? { name: e.name, lastSeen: e.at, lastJoin: null, sessions: 0, totalMinutes: 0 };
    p.lastSeen = e.at;
    if (e.kind === 'join') { p.lastJoin = e.at; p.sessions++; p.openJoin = Date.parse(e.at); }
    else if (p.openJoin) { p.totalMinutes += Math.max(0, Math.round((Date.parse(e.at) - p.openJoin) / 60000)); p.openJoin = undefined; }
    map.set(e.name, p);
  }
  // los que están dentro ahora mismo cuentan el tiempo de la sesión actual
  for (const o of online) {
    const p = map.get(o.name) ?? { name: o.name, lastSeen: new Date().toISOString(), lastJoin: new Date(o.joinedAt).toISOString(), sessions: 1, totalMinutes: 0 };
    p.lastSeen = new Date().toISOString();
    p.totalMinutes += Math.round((Date.now() - o.joinedAt) / 60000);
    p.openJoin = undefined;
    map.set(o.name, p);
  }
  const players = [...map.values()].map(({ openJoin: _o, ...p }) => p).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  return { recent: events.slice(-30).reverse(), players };
}
