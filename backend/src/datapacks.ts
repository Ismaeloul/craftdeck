import { readFile, readdir, rm, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { serverDir, getServer, audit } from './store.js';
import { fetchJson, download, writeFileAtomic } from './util.js';
import { runtimeOf, sendCommand } from './instance.js';

/**
 * Datapacks (world/datapacks): lo único que puede usar un servidor vanilla puro para
 * añadir contenido, y valen en cualquier loader. Se instalan desde Modrinth
 * (project_type datapack) o subiendo un .zip. Se cargan al arrancar o con /reload.
 */
const MODRINTH = 'https://api.modrinth.com/v2';
const FILE_RE = /^[A-Za-z0-9._+ '()\[\]-]+\.zip(\.disabled)?$/;

interface TrackedPack { filename: string; projectId: string; slug?: string; name: string; versionId: string; versionNumber: string; iconUrl?: string }
export interface InstalledPack { filename: string; name: string; enabled: boolean; tracked: boolean; iconUrl?: string; versionNumber?: string; slug?: string; projectId?: string }

function packsDir(id: string): string { return path.join(serverDir(id), 'world', 'datapacks'); }
function trackFile(id: string): string { return path.join(serverDir(id), 'craftdeck-datapacks.json'); }
async function readTracked(id: string): Promise<TrackedPack[]> {
  try { return JSON.parse(await readFile(trackFile(id), 'utf8')); } catch { return []; }
}
async function writeTracked(id: string, packs: TrackedPack[]): Promise<void> {
  await writeFileAtomic(trackFile(id), JSON.stringify(packs, null, 2));
}
function safePath(id: string, filename: string): string {
  if (!FILE_RE.test(filename) || filename.includes('/') || filename.includes('\\')) throw new Error('Nombre de datapack inválido (solo .zip)');
  return path.join(packsDir(id), filename);
}

export async function listDatapacks(id: string): Promise<InstalledPack[]> {
  let files: string[] = [];
  try { files = (await readdir(packsDir(id))).filter((f) => FILE_RE.test(f)); } catch { /* sin mundo aún */ }
  const tracked = await readTracked(id);
  return files.map((f) => {
    const base = f.replace(/\.disabled$/, '');
    const t = tracked.find((p) => p.filename === base);
    return { filename: base, enabled: !f.endsWith('.disabled'), tracked: !!t, name: t?.name ?? base.replace(/\.zip$/, ''), iconUrl: t?.iconUrl, versionNumber: t?.versionNumber, slug: t?.slug, projectId: t?.projectId };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

interface Version { id: string; project_id: string; version_number: string; files: { url: string; filename: string; primary: boolean }[] }

export async function installDatapack(id: string, project: string): Promise<string> {
  const meta = await getServer(id);
  if (!meta) throw new Error('Servidor no encontrado');
  const url = `${MODRINTH}/project/${encodeURIComponent(project)}/version?loaders=${encodeURIComponent('["datapack"]')}&game_versions=${encodeURIComponent(JSON.stringify([meta.mcVersion]))}`;
  const versions = await fetchJson<Version[]>(url);
  const ver = versions[0];
  if (!ver) throw new Error(`«${project}» no tiene versión datapack para Minecraft ${meta.mcVersion}`);
  const file = ver.files.find((f) => f.primary && f.filename.endsWith('.zip')) ?? ver.files.find((f) => f.filename.endsWith('.zip'));
  if (!file) throw new Error('Esa versión no trae un .zip de datapack');
  const proj = await fetchJson<{ title: string; slug: string; icon_url?: string | null }>(`${MODRINTH}/project/${ver.project_id}`);
  await mkdir(packsDir(id), { recursive: true });
  await download(file.url, path.join(packsDir(id), file.filename));
  const tracked = (await readTracked(id)).filter((p) => p.projectId !== ver.project_id);
  tracked.push({ filename: file.filename, projectId: ver.project_id, slug: proj.slug, name: proj.title, versionId: ver.id, versionNumber: ver.version_number, iconUrl: proj.icon_url ?? '' });
  await writeTracked(id, tracked);
  await audit('package', `Instaló el datapack ${proj.title}`, 'ok');
  await reloadIfOnline(id);
  return proj.title;
}

export async function addUploadedDatapack(id: string, filename: string, tmpPath: string): Promise<void> {
  await mkdir(packsDir(id), { recursive: true });
  await copyFile(tmpPath, safePath(id, filename));
  await rm(tmpPath, { force: true });
  await audit('upload', `Subió el datapack ${filename}`, 'ok');
  await reloadIfOnline(id);
}

export async function removeDatapack(id: string, filename: string): Promise<void> {
  const p = safePath(id, filename);
  await rm(p, { force: true });
  await rm(p + '.disabled', { force: true });
  await writeTracked(id, (await readTracked(id)).filter((t) => t.filename !== filename));
  await audit('trash', `Eliminó el datapack ${filename}`, 'warn');
  await reloadIfOnline(id);
}

export async function toggleDatapack(id: string, filename: string, enabled: boolean): Promise<void> {
  const base = safePath(id, filename);
  const { rename, access } = await import('node:fs/promises');
  const target = enabled ? base : base + '.disabled';
  const source = enabled ? base + '.disabled' : base;
  try { await access(target); return; } catch { /* cambiar */ }
  await rename(source, target);
  await reloadIfOnline(id);
}

/** Con el servidor encendido, /reload aplica los cambios de datapacks sin reiniciar. */
async function reloadIfOnline(id: string): Promise<boolean> {
  if (runtimeOf(id).status !== 'online') return false;
  try { sendCommand(id, 'reload'); return true; } catch { return false; }
}
