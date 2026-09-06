import { mkdir, readFile, rm, cp, stat } from 'node:fs/promises';
import path from 'node:path';
import extractZip from 'extract-zip';
import { CACHE_DIR } from './paths.js';
import { fetchJson, download } from './util.js';
import { Loader, ServerMeta, serverDir, updateServer, audit, contentDirName } from './store.js';
import { ModrinthVersion, TrackedMod, readTracked, writeTracked, listMods, contentDir } from './mods.js';
import { createZip } from './backups.js';

const MODRINTH = 'https://api.modrinth.com/v2';

/** Formato modrinth.index.json de un .mrpack. */
interface MrpackIndex {
  formatVersion: number;
  game: string;
  versionId: string;
  name: string;
  files: {
    path: string;
    hashes: { sha1: string; sha512: string };
    env?: { client: string; server: string };
    downloads: string[];
    fileSize: number;
  }[];
  dependencies: Record<string, string>; // minecraft, fabric-loader, forge, neoforge, quilt-loader
}

export interface ModpackVersionInfo { id: string; name: string; versionNumber: string; game: string; loader: Loader; loaderVersion: string }

/** Versiones publicadas de un modpack con el loader/MC que piden (para elegir en el asistente). */
export async function listModpackVersions(project: string): Promise<ModpackVersionInfo[]> {
  const versions = await fetchJson<(ModrinthVersion & { name: string; loaders: string[]; game_versions: string[] })[]>(
    `${MODRINTH}/project/${encodeURIComponent(project)}/version`,
  );
  const out: ModpackVersionInfo[] = [];
  for (const v of versions.slice(0, 30)) {
    const loader = v.loaders.find((l): l is Loader => ['fabric', 'forge', 'neoforge'].includes(l));
    if (!loader) continue; // quilt u otros: no soportado
    out.push({ id: v.id, name: v.name, versionNumber: v.version_number, game: v.game_versions[0] ?? '', loader, loaderVersion: '' });
  }
  return out;
}

/** Descarga y lee el .mrpack de una versión concreta; devuelve el índice y la ruta del zip. */
async function fetchMrpack(versionId: string): Promise<{ index: MrpackIndex; zip: string; version: ModrinthVersion & { name: string } }> {
  const version = await fetchJson<ModrinthVersion & { name: string }>(`${MODRINTH}/version/${encodeURIComponent(versionId)}`);
  const file = version.files.find((f) => f.primary && f.filename.endsWith('.mrpack')) ?? version.files.find((f) => f.filename.endsWith('.mrpack'));
  if (!file) throw new Error('Esa versión del modpack no tiene archivo .mrpack');
  await mkdir(CACHE_DIR, { recursive: true });
  const zip = path.join(CACHE_DIR, `mrpack-${version.id}.mrpack`);
  await download(file.url, zip);
  const tmp = path.join(CACHE_DIR, `mrpack-${version.id}`);
  await rm(tmp, { recursive: true, force: true });
  await extractZip(zip, { dir: tmp });
  const index = JSON.parse(await readFile(path.join(tmp, 'modrinth.index.json'), 'utf8')) as MrpackIndex;
  await rm(tmp, { recursive: true, force: true });
  return { index, zip, version };
}

/** Lee el índice del modpack para saber qué loader y versión de MC pide (antes de crear el servidor). */
export async function inspectModpack(versionId: string): Promise<{ name: string; game: string; loader: Loader; loaderVersion: string; files: number }> {
  const { index } = await fetchMrpack(versionId);
  const deps = index.dependencies;
  const game = deps['minecraft'];
  if (!game) throw new Error('El modpack no indica versión de Minecraft');
  let loader: Loader | null = null; let loaderVersion = '';
  if (deps['fabric-loader']) { loader = 'fabric'; loaderVersion = deps['fabric-loader']; }
  else if (deps['neoforge']) { loader = 'neoforge'; loaderVersion = deps['neoforge']; }
  else if (deps['forge']) { loader = 'forge'; loaderVersion = deps['forge']; }
  else if (deps['quilt-loader']) throw new Error('Este modpack es de Quilt, que CraftDeck no soporta todavía');
  if (!loader) throw new Error('El modpack no indica loader (Fabric, Forge o NeoForge)');
  return { name: index.name, game, loader, loaderVersion, files: index.files.length };
}

/**
 * Vuelca el contenido del modpack en el directorio del servidor: mods del índice
 * (solo los que el servidor necesita) y overrides. Se llama antes de aprovisionar.
 */
export async function applyModpack(meta: ServerMeta, versionId: string, log: (m: string) => Promise<void>): Promise<void> {
  const dir = serverDir(meta.id);
  await mkdir(dir, { recursive: true });
  const { index, zip, version } = await fetchMrpack(versionId);

  // overrides/ y server-overrides/ (configs, datapacks, mods extra…)
  const tmp = path.join(CACHE_DIR, `mrpack-apply-${meta.id}`);
  await rm(tmp, { recursive: true, force: true });
  await extractZip(zip, { dir: tmp });
  for (const sub of ['overrides', 'server-overrides']) {
    try {
      await stat(path.join(tmp, sub));
      await cp(path.join(tmp, sub), dir, { recursive: true, force: true });
      await log(`Aplicado ${sub}/ del modpack`);
    } catch { /* no hay */ }
  }
  await rm(tmp, { recursive: true, force: true });

  // archivos del índice (mods, resourcepacks, shaderpacks…): los de cliente puro se saltan
  const serverFiles = index.files.filter((f) => f.env?.server !== 'unsupported');
  await log(`Descargando ${serverFiles.length} archivos del modpack (${index.files.length - serverFiles.length} solo de cliente se omiten)…`);
  const tracked = await readTracked(meta.id);
  let n = 0;
  for (const f of serverFiles) {
    const rel = f.path.replace(/\\/g, '/');
    if (rel.includes('..') || rel.startsWith('/')) continue;
    const dest = path.join(dir, ...rel.split('/'));
    await download(f.downloads[0]!, dest);
    n++;
    if (n % 10 === 0) await log(`${n}/${serverFiles.length} archivos…`);
    // seguimiento para poder actualizar/migrar desde el panel: el nombre viene del path
    if (rel.startsWith('mods/') && rel.endsWith('.jar')) {
      const filename = path.basename(rel);
      if (!tracked.some((t) => t.filename === filename)) {
        tracked.push(await trackFromDownload(filename, f.downloads[0]!, f.fileSize, f.hashes));
      }
    }
  }
  await writeTracked(meta.id, tracked);
  await updateServer(meta.id, {
    modpack: { project: version.project_id, name: index.name, versionId: version.id, versionNumber: version.version_number },
  });
  await log(`Modpack «${index.name}» ${version.version_number} aplicado (${n} archivos).`);
  await audit('package', `Instaló el modpack ${index.name} ${version.version_number} en ${meta.name}`, 'ok');
}

/** Identifica el mod a partir de la URL del CDN de Modrinth (…/data/<project>/versions/<version>/<file>). */
async function trackFromDownload(filename: string, url: string, size: number, hashes: { sha1: string; sha512: string }): Promise<TrackedMod> {
  const m = url.match(/cdn\.modrinth\.com\/data\/([\w-]+)\/versions\/([\w-]+)\//);
  const base: TrackedMod = {
    filename, projectId: m?.[1] ?? '', name: filename.replace(/\.jar$/, ''), versionId: m?.[2] ?? '',
    versionNumber: '', url, size, sha1: hashes?.sha1, sha512: hashes?.sha512,
  };
  if (!m) return base;
  try {
    const [proj, ver] = await Promise.all([
      fetchJson<{ title: string; slug: string }>(`${MODRINTH}/project/${m[1]}`),
      fetchJson<{ version_number: string }>(`${MODRINTH}/version/${m[2]}`),
    ]);
    return { ...base, name: proj.title, slug: proj.slug, versionNumber: ver.version_number };
  } catch {
    return base;
  }
}

/**
 * Pack de amigos en formato .mrpack: los mods de Modrinth van como referencias
 * (el launcher los descarga) y los subidos a mano dentro de overrides/mods.
 * Prism, Modrinth App, ATLauncher… lo importan directamente.
 */
export async function writeMrpack(meta: ServerMeta, dest: NodeJS.WritableStream): Promise<number> {
  const mods = (await listMods(meta.id)).filter((m) => m.enabled);
  const dir = await contentDir(meta.id);
  const sub = contentDirName(meta.loader);
  const files: MrpackIndex['files'] = [];
  const overrides: string[] = [];
  for (const m of mods) {
    if (m.tracked && m.url && m.sha1 && m.sha512 && m.size) {
      files.push({
        path: `${sub}/${m.filename}`, hashes: { sha1: m.sha1, sha512: m.sha512 },
        env: { client: 'required', server: 'optional' }, downloads: [m.url], fileSize: m.size,
      });
    } else {
      overrides.push(m.filename);
    }
  }
  const deps: Record<string, string> = { minecraft: meta.mcVersion };
  const loaderKey = meta.loader === 'fabric' ? 'fabric-loader' : meta.loader;
  if (meta.loaderVersion && ['fabric', 'forge', 'neoforge'].includes(meta.loader)) deps[loaderKey] = meta.loaderVersion;
  const index: MrpackIndex = {
    formatVersion: 1, game: 'minecraft', versionId: new Date().toISOString().slice(0, 10),
    name: `${meta.name} (CraftDeck)`, files, dependencies: deps,
  };
  const archive = createZip();
  archive.on('error', () => { /* el destino ya se destruye desde la ruta */ });
  archive.pipe(dest);
  archive.append(JSON.stringify(index, null, 2), { name: 'modrinth.index.json' });
  for (const f of overrides) archive.file(path.join(dir, f), { name: `overrides/${sub}/${f}` });
  await archive.finalize();
  return files.length + overrides.length;
}

