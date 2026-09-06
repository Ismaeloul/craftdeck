import { readFile, readdir, rm, rename, mkdir, access, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { serverDir, getServer, audit, contentDirName, supportsContent, Loader } from './store.js';
import { fetchJson, download, writeFileAtomic } from './util.js';

const MODRINTH = 'https://api.modrinth.com/v2';
const FILE_RE = /^[A-Za-z0-9._+ '()\[\]-]+\.jar(\.disabled)?$/;

/** Loaders de Modrinth que valen para cada tipo de servidor (Paper corre plugins de Spigot/Bukkit). */
export function modrinthLoaders(loader: Loader): string[] {
  return loader === 'paper' ? ['paper', 'spigot', 'bukkit'] : [loader];
}

export interface ModrinthFile { url: string; filename: string; primary: boolean; size: number; hashes: { sha1: string; sha512: string } }
export interface ModrinthVersion {
  id: string;
  project_id: string;
  version_number: string;
  files: ModrinthFile[];
  dependencies: { project_id: string | null; dependency_type: string }[];
}

export interface TrackedMod {
  filename: string;
  projectId: string;
  slug?: string;
  name: string;
  versionId: string;
  versionNumber: string;
  // para exportar el pack como .mrpack sin volver a preguntar a Modrinth
  url?: string;
  size?: number;
  sha1?: string;
  sha512?: string;
}

export interface InstalledMod extends Partial<TrackedMod> {
  filename: string;
  name: string;
  enabled: boolean;
  tracked: boolean;
}

export async function contentDir(id: string): Promise<string> {
  const meta = await getServer(id);
  return path.join(serverDir(id), contentDirName(meta?.loader ?? 'fabric'));
}
function trackFile(id: string): string { return path.join(serverDir(id), 'craftdeck-mods.json'); }

export async function readTracked(id: string): Promise<TrackedMod[]> {
  try { return JSON.parse(await readFile(trackFile(id), 'utf8')); } catch { return []; }
}
export async function writeTracked(id: string, mods: TrackedMod[]): Promise<void> {
  await writeFileAtomic(trackFile(id), JSON.stringify(mods, null, 2));
}

async function loaderOf(id: string): Promise<{ loader: Loader; loaders: string[]; game: string }> {
  const meta = await getServer(id);
  if (!meta) throw new Error('Servidor no encontrado');
  if (!supportsContent(meta.loader)) throw new Error('Un servidor vanilla no admite mods ni plugins. Crea uno Paper (plugins) o Fabric/Forge/NeoForge (mods).');
  return { loader: meta.loader, loaders: modrinthLoaders(meta.loader), game: meta.mcVersion };
}

export async function listMods(id: string): Promise<InstalledMod[]> {
  let files: string[] = [];
  try { files = (await readdir(await contentDir(id))).filter((f) => FILE_RE.test(f)); } catch { /* sin mods/ */ }
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

/** Mejor versión compatible de un proyecto para el loader/versión del server (null si no hay). */
export async function findVersion(project: string, loaders: string[], game: string): Promise<ModrinthVersion | null> {
  const url = `${MODRINTH}/project/${encodeURIComponent(project)}/version` +
    `?loaders=${encodeURIComponent(JSON.stringify(loaders))}` +
    `&game_versions=${encodeURIComponent(JSON.stringify([game]))}`;
  const versions = await fetchJson<ModrinthVersion[]>(url);
  return versions[0] ?? null;
}
async function bestVersion(project: string, loaders: string[], game: string): Promise<ModrinthVersion> {
  const v = await findVersion(project, loaders, game);
  if (!v) throw new Error(`No hay versión de «${project}» para ${loaders[0]} ${game}`);
  return v;
}

function trackedFromVersion(ver: ModrinthVersion, file: ModrinthFile, proj: { title: string; slug: string }): TrackedMod {
  return {
    filename: file.filename, projectId: ver.project_id, slug: proj.slug,
    name: proj.title, versionId: ver.id, versionNumber: ver.version_number,
    url: file.url, size: file.size, sha1: file.hashes?.sha1, sha512: file.hashes?.sha512,
  };
}

/** Instala un proyecto y sus dependencias requeridas. Devuelve los nombres instalados. */
export async function installMod(id: string, project: string): Promise<string[]> {
  const { loaders, game } = await loaderOf(id);
  const dir = await contentDir(id);
  await mkdir(dir, { recursive: true });
  const tracked = await readTracked(id);
  const installed: string[] = [];
  const queue = [project];
  const seen = new Set<string>();

  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const ver = await bestVersion(current, loaders, game);
    if (tracked.some((m) => m.projectId === ver.project_id)) continue; // ya instalado
    const file = ver.files.find((f) => f.primary) ?? ver.files[0];
    if (!file) throw new Error(`«${current}» no tiene archivo descargable`);
    const proj = await fetchJson<{ title: string; slug: string }>(`${MODRINTH}/project/${ver.project_id}`);
    await download(file.url, path.join(dir, file.filename));
    tracked.push(trackedFromVersion(ver, file, proj));
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

/** Un .jar subido a mano (p. ej. de CurseForge): se copia a mods/ o plugins/ sin seguimiento de versiones. */
export async function addUploadedJar(id: string, filename: string, tmpPath: string): Promise<void> {
  await loaderOf(id);
  const dir = await contentDir(id);
  await mkdir(dir, { recursive: true });
  const dest = safeModPathIn(dir, filename);
  await copyFile(tmpPath, dest);
  await rm(tmpPath, { force: true });
  await audit('upload', `Subió el archivo ${filename}`, 'ok');
}

function safeModPathIn(dir: string, filename: string): string {
  if (!FILE_RE.test(filename) || filename.includes('/') || filename.includes('\\')) throw new Error('Nombre de archivo inválido (solo .jar)');
  return path.join(dir, filename);
}
async function safeModPath(id: string, filename: string): Promise<string> {
  return safeModPathIn(await contentDir(id), filename);
}

export async function removeMod(id: string, filename: string): Promise<void> {
  const p = await safeModPath(id, filename);
  await rm(p, { force: true });
  await rm(p + '.disabled', { force: true });
  await writeTracked(id, (await readTracked(id)).filter((m) => m.filename !== filename));
  await audit('trash', `Eliminó ${filename}`, 'warn');
}

export async function toggleMod(id: string, filename: string, enabled: boolean): Promise<void> {
  const base = await safeModPath(id, filename);
  const target = enabled ? base : base + '.disabled';
  const source = enabled ? base + '.disabled' : base;
  try { await access(target); return; } catch { /* aún no está en el estado pedido */ }
  await rename(source, target);
}

/** Rutas absolutas de los jars activos, para el pack de amigos. */
export async function enabledModJarPaths(id: string): Promise<string[]> {
  const mods = await listMods(id);
  const dir = await contentDir(id);
  return mods.filter((m) => m.enabled).map((m) => path.join(dir, m.filename));
}

export interface ModUpdate { filename: string; name: string; current: string; latest: string }

export async function checkModUpdates(id: string): Promise<ModUpdate[]> {
  const { loaders, game } = await loaderOf(id);
  const tracked = await readTracked(id);
  const updates: ModUpdate[] = [];
  for (const mod of tracked) {
    try {
      const latest = await bestVersion(mod.projectId, loaders, game);
      if (latest.id !== mod.versionId) {
        updates.push({ filename: mod.filename, name: mod.name, current: mod.versionNumber, latest: latest.version_number });
      }
    } catch { /* proyecto retirado o sin versión: ignorar */ }
  }
  return updates;
}

async function replaceWith(id: string, mod: TrackedMod, ver: ModrinthVersion): Promise<void> {
  const dir = await contentDir(id);
  const file = ver.files.find((f) => f.primary) ?? ver.files[0]!;
  await download(file.url, path.join(dir, file.filename));
  if (file.filename !== mod.filename) {
    await rm(path.join(dir, mod.filename), { force: true });
    await rm(path.join(dir, mod.filename + '.disabled'), { force: true });
  }
  const slug = mod.slug;
  Object.assign(mod, trackedFromVersion(ver, file, { title: mod.name, slug: slug ?? '' }), { slug });
}

export async function updateMod(id: string, filename: string): Promise<string> {
  const { loaders, game } = await loaderOf(id);
  const tracked = await readTracked(id);
  const mod = tracked.find((m) => m.filename === filename);
  if (!mod) throw new Error('Ese mod no está gestionado por CraftDeck');
  const ver = await bestVersion(mod.projectId, loaders, game);
  await replaceWith(id, mod, ver);
  await writeTracked(id, tracked);
  await audit('package', `Actualizó ${mod.name} a ${ver.version_number}`, 'ok');
  return ver.version_number;
}

export interface Migration { updated: string[]; kept: string[]; disabled: string[]; manual: string[] }

/**
 * Tras cambiar la versión de Minecraft: cada mod gestionado se pasa a una versión
 * compatible; los que no la tienen se desactivan (no se borran). Los subidos a mano
 * se dejan como están y se avisa.
 */
export async function migrateMods(id: string): Promise<Migration> {
  const { loaders, game } = await loaderOf(id);
  const tracked = await readTracked(id);
  const out: Migration = { updated: [], kept: [], disabled: [], manual: [] };
  for (const mod of tracked) {
    let ver: ModrinthVersion | null = null;
    try { ver = await findVersion(mod.projectId, loaders, game); } catch { ver = null; }
    if (!ver) {
      try { await toggleMod(id, mod.filename, false); } catch { /* ya estaba desactivado o no existe */ }
      out.disabled.push(mod.name);
    } else if (ver.id === mod.versionId) {
      out.kept.push(mod.name);
    } else {
      await replaceWith(id, mod, ver);
      out.updated.push(mod.name);
    }
  }
  await writeTracked(id, tracked);
  for (const m of await listMods(id)) if (!m.tracked) out.manual.push(m.name);
  await audit('package', `Migró los mods a ${game}: ${out.updated.length} actualizados, ${out.disabled.length} desactivados por incompatibles`, out.disabled.length ? 'warn' : 'ok');
  return out;
}
