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
  /** filename del jar en mods/ cuando el culpable es un mod instalado (permite desactivarlo desde el panel) */
  culpritFilename?: string;
}

const FILE_RE = /^crash-[\w.-]+\.txt$/;

function crashDir(id: string): string { return path.join(serverDir(id), 'crash-reports'); }

// frameworks y runtime: nunca son «el culpable»
const TRACE_IGNORE = /^(minecraft|neoforge|forge|fabric|fabricloader|fabric_api|java|mixin|mixinextras|fml|modlauncher|bus|eventbus|sponge|knot|server|loader|at)$/;
const JAR_IGNORE = /^(server-|minecraft|neoforge-|forge-|fabric-loader|fabric-api|sponge-mixin|bus-|modlauncher|loader-|at-modlauncher|mixinextras)/i;

/** Sospechosos sacados de la traza del error, en orden de aparición (los frames más cercanos al fallo primero). */
function traceSuspects(text: string): string[] {
  const head = text.split(/-- System Details --/)[0] ?? text;
  const suspects: string[] = [];
  const push = (s: string) => { const v = s.toLowerCase(); if (!suspects.includes(v)) suspects.push(v); };
  for (const line of head.split(/\r?\n/)) {
    if (!/^\s+at /.test(line)) continue;
    const modId = line.match(/TRANSFORMER\/([a-z0-9_.-]+)@/)?.[1];
    if (modId && !TRACE_IGNORE.test(modId)) push(modId);
    const jar = line.match(/[~[(]\[?([\w.\-+' ]+?\.jar)/)?.[1];
    if (jar && !JAR_IGNORE.test(jar)) push(jar);
  }
  return suspects;
}

/** Heurísticas honestas: si no está claro, el culpable es «desconocido». */
async function analyze(id: string, text: string): Promise<Pick<CrashInfo, 'headline' | 'culprit' | 'reason' | 'fix' | 'culpritFilename'>> {
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
  // 1º: mods que aparecen en la TRAZA del error — señal fuerte, en orden de cercanía al fallo
  const suspects = traceSuspects(text);
  let mods: Awaited<ReturnType<typeof listMods>> = [];
  try { mods = await listMods(id); } catch { /* server vanilla o sin mods */ }
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const suspect of suspects) {
    const sNorm = norm(suspect);
    for (const mod of mods) {
      const keys = [mod.slug, mod.name, mod.filename].filter((k): k is string => !!k).map(norm);
      if (keys.some((k) => k.length >= 3 && sNorm.length >= 3 && (sNorm.includes(k) || k.includes(sNorm)))) {
        return {
          headline, culprit: mod.name, culpritFilename: mod.filename,
          reason: `«${mod.name}» aparece directamente en la traza del error (${suspect}).`,
          fix: `Actualiza «${mod.name}» desde la sección Mods (botón de actualizaciones) o desactívalo y reinicia. Si el crash desaparece, era él.`,
        };
      }
    }
  }
  if (suspects.length) {
    return {
      headline, culprit: suspects[0]!,
      reason: `La traza del error apunta a «${suspects[0]}».`,
      fix: 'Busca ese mod en la sección Mods, desactívalo y reinicia.',
    };
  }
  // 2º: heurística débil — algún mod mencionado en la parte del error (NO en System Details,
  // que lista todos los mods instalados y convertiría a cualquiera en «culpable»)
  const textNorm = norm(text.split(/-- System Details --/)[0] ?? text);
  for (const mod of mods) {
    const key = norm(mod.slug ?? mod.name);
    if (key.length >= 4 && textNorm.includes(key)) {
      return {
        headline, culprit: mod.name, culpritFilename: mod.filename,
        reason: `El mod «${mod.name}» aparece en el reporte (señal débil: no está en la traza del error).`,
        fix: `Prueba a desactivar «${mod.name}» en la sección Mods y reinicia. Si el crash desaparece, era él.`,
      };
    }
  }
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

/** Crash report más reciente escrito después de `sinceMs`, ya analizado (o null si no hay). */
export async function latestCrash(id: string, sinceMs: number): Promise<CrashInfo | null> {
  let files: string[] = [];
  try { files = (await readdir(crashDir(id))).filter((f) => FILE_RE.test(f)); } catch { return null; }
  let best: { file: string; mtime: Date } | null = null;
  for (const file of files) {
    try {
      const st = await stat(path.join(crashDir(id), file));
      if (st.mtime.getTime() >= sinceMs && (!best || st.mtime > best.mtime)) best = { file, mtime: st.mtime };
    } catch { /* ilegible: saltar */ }
  }
  if (!best) return null;
  try {
    const text = await readFile(path.join(crashDir(id), best.file), 'utf8');
    return { file: best.file, date: best.mtime.toISOString(), ...(await analyze(id, text)) };
  } catch {
    return null;
  }
}

export async function crashText(id: string, file: string): Promise<string> {
  if (!FILE_RE.test(file)) throw new Error('Nombre de reporte inválido');
  const text = await readFile(path.join(crashDir(id), file), 'utf8');
  return text.length > 200_000 ? text.slice(0, 200_000) + '\n… (truncado)' : text;
}
