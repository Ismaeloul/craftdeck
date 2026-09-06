import { readFile } from 'node:fs/promises';
import os from 'node:os';

export interface SystemMemory {
  totalMb: number;
  /** RAM que un servidor nuevo podría usar de verdad: MemAvailable + la caché ARC de ZFS (reclamable). */
  availableMb: number;
  zfsArcMb: number;
}

/**
 * En un Umbrel con ZFS, `free` engaña: la caché ARC cuenta como «usada» aunque el kernel
 * la suelta en cuanto alguien pide memoria. Si podemos leer arcstats, la sumamos.
 */
async function zfsArcBytes(): Promise<number> {
  try {
    const raw = await readFile('/proc/spl/kstat/zfs/arcstats', 'utf8');
    const m = raw.match(/^size\s+\d+\s+(\d+)/m);
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
}

export async function systemMemory(): Promise<SystemMemory> {
  const arc = await zfsArcBytes();
  const toMb = (b: number) => Math.round(b / 1048576);
  return {
    totalMb: toMb(os.totalmem()),
    availableMb: toMb(os.freemem() + arc),
    zfsArcMb: toMb(arc),
  };
}
