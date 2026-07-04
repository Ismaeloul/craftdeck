import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { serverDir } from './store.js';
import { listMods } from './mods.js';

export interface CrashInfo {
  file: string;
  date: string;
  headline: string;
  culprit: string;
  reason: string;
  fix: string;
}

const FILE_RE = /^crash-[\w.-]+\.txt$/;

function crashDir(id: string): string { return path.join(serverDir(id), 'crash-reports'); }

/** Heurísticas honestas: si no está claro, el culpable es «desconocido». */
async function analyze(id: string, text: string): Promise<Pick<CrashInfo, 'headline' | 'culprit' | 'reason' | 'fix'>> {
  const lines = text.split(/\r?\n/);
  const headline = lines.find((l) => l.trim() && !l.startsWith('---') && !l.startsWith('//') && l.includes('Description:'))
    ?.replace('Description:', '').trim()
    ?? lines.find((l) => /Exception|Error/.test(l))?.trim()
    ?? 'Crash sin descripción';

  if (/OutOfMemoryError/i.test(text)) {
    return {
      headline, culprit: 'Memoria insuficiente (OutOfMemoryError)',
      reason: 'El servidor se quedó sin la RAM asignada.',
      fix: 'Sube la RAM del servidor o baja la distancia de renderizado en Mundo.',
    };
  }
  if (/Mixin apply.*failed|MixinApplyError|InvalidMixinException/i.test(text)) {
    return {
      headline, culprit: 'Conflicto de mods (mixin)',
      reason: 'Dos mods intentan modificar la misma parte del juego y chocan.',
      fix: 'Mira qué mods aparecen en el reporte y desactiva el que hayas instalado más recientemente.',
    };
  }
  // ¿aparece algún mod instalado en el stacktrace?
  try {
    const mods = await listMods(id);
    for (const mod of mods) {
      const key = (mod.slug ?? mod.name).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (key.length >= 4 && text.toLowerCase().replace(/[^a-z0-9]/g, '').includes(key)) {
        return {
          headline, culprit: mod.name,
          reason: `El mod «${mod.name}» aparece en el rastro del error.`,
          fix: `Prueba a desactivar «${mod.name}» en la sección Mods y reinicia. Si el crash desaparece, era él.`,
        };
      }
    }
  } catch { /* server vanilla o sin mods */ }
  return {
    headline, culprit: 'Desconocido',
    reason: 'No se pudo identificar un culpable claro automáticamente.',
    fix: 'Revisa el reporte completo; la primera sección suele señalar la causa.',
  };
}

export async function listCrashes(id: string): Promise<CrashInfo[]> {
  let files: string[] = [];
  try { files = (await readdir(crashDir(id))).filter((f) => FILE_RE.test(f)); } catch { return []; }
  const out: CrashInfo[] = [];
  for (const file of files.sort().reverse().slice(0, 10)) {
    try {
      const [text, st] = await Promise.all([
        readFile(path.join(crashDir(id), file), 'utf8'),
        stat(path.join(crashDir(id), file)),
      ]);
      out.push({ file, date: st.mtime.toISOString(), ...(await analyze(id, text)) });
    } catch { /* ilegible: saltar */ }
  }
  return out;
}

export async function crashText(id: string, file: string): Promise<string> {
  if (!FILE_RE.test(file)) throw new Error('Nombre de reporte inválido');
  const text = await readFile(path.join(crashDir(id), file), 'utf8');
  return text.length > 200_000 ? text.slice(0, 200_000) + '\n… (truncado)' : text;
}
