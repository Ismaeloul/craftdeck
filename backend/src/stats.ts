import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { serverDir } from './store.js';

/** JSON.parse tolerante con BOM (archivos tocados desde Windows/Notepad). */
function parseJson<T>(raw: string): T {
  return JSON.parse(raw.replace(/^﻿/, '')) as T;
}

export interface PlayerStats {
  name: string;
  playTimeHours: number;
  deaths: number;
  blocksMined: number;
  mobKills: number;
  advancements: number;
}

async function nameMap(id: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const cache = parseJson<{ name: string; uuid: string }[]>(await readFile(path.join(serverDir(id), 'usercache.json'), 'utf8'));
    for (const e of cache) map.set(e.uuid.toLowerCase(), e.name);
  } catch { /* sin usercache */ }
  return map;
}

export async function playerStats(id: string): Promise<PlayerStats[]> {
  const statsDir = path.join(serverDir(id), 'world', 'stats');
  let files: string[] = [];
  try { files = (await readdir(statsDir)).filter((f) => f.endsWith('.json')); } catch { return []; }
  const names = await nameMap(id);
  const out: PlayerStats[] = [];
  for (const file of files) {
    try {
      const uuid = file.replace(/\.json$/, '').toLowerCase();
      const data = parseJson<{ stats?: Record<string, Record<string, number>> }>(await readFile(path.join(statsDir, file), 'utf8'));
      const custom = data.stats?.['minecraft:custom'] ?? {};
      const mined = data.stats?.['minecraft:mined'] ?? {};
      let advancements = 0;
      try {
        const adv = parseJson<Record<string, { done?: boolean }>>(await readFile(path.join(serverDir(id), 'world', 'advancements', file), 'utf8'));
        advancements = Object.entries(adv).filter(([k, v]) => !k.includes('recipes/') && v && v.done === true).length;
      } catch { /* sin advancements */ }
      out.push({
        name: names.get(uuid) ?? uuid.slice(0, 8),
        playTimeHours: Math.round(((custom['minecraft:play_time'] ?? 0) / 20 / 3600) * 10) / 10,
        deaths: custom['minecraft:deaths'] ?? 0,
        blocksMined: Object.values(mined).reduce((a, b) => a + b, 0),
        mobKills: custom['minecraft:mob_kills'] ?? 0,
        advancements,
      });
    } catch { /* archivo corrupto: saltar */ }
  }
  return out.sort((a, b) => b.playTimeHours - a.playTimeHours);
}
