import { readFile, writeFile, readdir, rm, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { serverDir, getServer, audit } from './store.js';
import { fetchJson, download } from './util.js';

const MODRINTH = 'https://api.modrinth.com/v2';
const FILE_RE = /^[A-Za-z0-9._+ '()\[\]-]+\.jar(\.disabled)?$/;

interface ModrinthVersion {
  id: string;
  project_id: string;
  version_number: string;
  files: { url: string; filename: string; primary: boolean }[];
  dependencies: { project_id: string | null; dependency_type: string }[];
}

interface TrackedMod {
  filename: string;
  projectId: string;
  slug?: string;
  name: string;
  versionId: string;
  versionNumber: string;
}

export interface InstalledMod extends Partial<TrackedMod> {
  filename: string;
  name: string;
  enabled: boolean;
  tracked: boolean;
}

function modsDir(id: string): string { return path.join(serverDir(id), 'mods'); }
function trackFile(id: string): string { return path.join(serverDir(id), 'craftdeck-mods.json'); }

async function readTracked(id: string): Promise<TrackedMod[]> {
  try { return JSON.parse(await readFile(trackFile(id), 'utf8')); } catch { return []; }
}
async function writeTracked(id: string, mods: TrackedMod[]): Promise<void> {
  await writeFile(trackFile(id), JSON.stringify(mods, null, 2));
}

async function loaderOf(id: string): Promise<{ loader: string; game: string }> {
  const meta = await getServer(id);
  if (!meta) throw new Error('Servidor no encontrado');
  if (meta.loader === 'vanilla') throw new Error('Un servidor vanilla no admite mods');
  return { loader: meta.loader, game: meta.mcVersion };
}

export async function listMods(id: string): Promise<InstalledMod[]> {
  let files: string[] = [];
  try { files = (await readdir(modsDir(id))).filter((f) => FILE_RE.test(f)); } catch { /* sin mods/ */ }
  const tracked = await readTracked(id);
  return files.map((f) => {
    const base = f.replace(/\.disabled$/, '');
    const t = tracked.find((m) => m.filename === base);
    return {
      filename: base,
      enabled: !f.endsWith('.disabled'),
      tracked: !!t,
      name: t?.name ?? base.replace(/\.jar$/, ''),
      ...(t ?? {}),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/** Mejor versión compatible de un proyecto para el loader/versión del server. */
async function bestVersion(project: string, loader: string, game: string): Promise<ModrinthVersion> {
  const url = `${MODRINTH}/project/${encodeURIComponent(project)}/version` +
    `?loaders=${encodeURIComponent(JSON.stringify([loader]))}` +
    `&game_versions=${encodeURIComponent(JSON.stringify([game]))}`;
  const versions = await fetchJson<ModrinthVersion[]>(url);
  if (!versions.length) throw new Error(`No hay versión de «${project}» para ${loader} ${game}`);
  return versions[0]!;
}

/** Instala un proyecto y sus dependencias requeridas. Devuelve los nombres instalados. */
export async function installMod(id: string, project: string): Promise<string[]> {
  const { loader, game } = await loaderOf(id);
  await mkdir(modsDir(id), { recursive: true });
  const tracked = await readTracked(id);
  const installed: string[] = [];
  const queue = [project];
  const seen = new Set<string>();

  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const ver = await bestVersion(current, loader, game);
    if (tracked.some((m) => m.projectId === ver.project_id)) continue; // ya instalado
    const file = ver.files.find((f) => f.primary) ?? ver.files[0];
    if (!file) throw new Error(`«${current}» no tiene archivo descargable`);
    const proj = await fetchJson<{ title: string; slug: string }>(`${MODRINTH}/project/${ver.project_id}`);
    await download(file.url, path.join(modsDir(id), file.filename));
    tracked.push({
      filename: file.filename, projectId: ver.project_id, slug: proj.slug,
      name: proj.title, versionId: ver.id, versionNumber: ver.version_number,
    });
    installed.push(proj.title);
    for (const dep of ver.dependencies) {
      if (dep.dependency_type === 'required' && dep.project_id) queue.push(dep.project_id);
    }
    if (seen.size > 15) throw new Error('Demasiadas dependencias; instalación abortada');
  }
  await writeTracked(id, tracked);
  if (installed.length) await audit('package', `Instaló ${installed.join(', ')}`, 'ok');
  return installed;
}

function safeModPath(id: string, filename: string): string {
  if (!FILE_RE.test(filename) || filename.includes('/') || filename.includes('\\')) throw new Error('Nombre de mod inválido');
  return path.join(modsDir(id), filename);
}

export async function removeMod(id: string, filename: string): Promise<void> {
  await rm(safeModPath(id, filename), { force: true });
  await rm(safeModPath(id, filename) + '.disabled', { force: true });
  await writeTracked(id, (await readTracked(id)).filter((m) => m.filename !== filename));
  await audit('trash', `Eliminó el mod ${filename}`, 'warn');
}

export async function toggleMod(id: string, filename: string, enabled: boolean): Promise<void> {
  const base = safeModPath(id, filename);
  if (enabled) await rename(base + '.disabled', base);
  else await rename(base, base + '.disabled');
}

export interface ModUpdate { filename: string; name: string; current: string; latest: string }

export async function checkModUpdates(id: string): Promise<ModUpdate[]> {
  const { loader, game } = await loaderOf(id);
  const tracked = await readTracked(id);
  const updates: ModUpdate[] = [];
  for (const mod of tracked) {
    try {
      const latest = await bestVersion(mod.projectId, loader, game);
      if (latest.id !== mod.versionId) {
        updates.push({ filename: mod.filename, name: mod.name, current: mod.versionNumber, latest: latest.version_number });
      }
    } catch { /* proyecto retirado o sin versión: ignorar */ }
  }
  return updates;
}

export async function updateMod(id: string, filename: string): Promise<string> {
  const { loader, game } = await loaderOf(id);
  const tracked = await readTracked(id);
  const mod = tracked.find((m) => m.filename === filename);
  if (!mod) throw new Error('Ese mod no está gestionado por CraftDeck');
  const ver = await bestVersion(mod.projectId, loader, game);
  const file = ver.files.find((f) => f.primary) ?? ver.files[0]!;
  await download(file.url, path.join(modsDir(id), file.filename));
  if (file.filename !== mod.filename) await rm(safeModPath(id, mod.filename), { force: true });
  Object.assign(mod, { filename: file.filename, versionId: ver.id, versionNumber: ver.version_number });
  await writeTracked(id, tracked);
  await audit('package', `Actualizó ${mod.name} a ${ver.version_number}`, 'ok');
  return ver.version_number;
}
