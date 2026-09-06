import { fetchJson } from '../util.js';

// PaperMC "fill" v3 (la v2 se apagó en 2026)
const API = 'https://fill.papermc.io/v3/projects/paper';

interface VersionsResponse {
  versions: { version: { id: string; support: { status: string }; java: { version: { minimum: number } } } }[];
}
interface BuildResponse {
  id: number;
  channel: string;
  downloads: Record<string, { name: string; url: string; size: number }>;
}

let cache: { at: number; data: VersionsResponse } | null = null;
async function versions(): Promise<VersionsResponse> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.data;
  const data = await fetchJson<VersionsResponse>(`${API}/versions`);
  cache = { at: Date.now(), data };
  return data;
}

/** Versiones de MC con build de Paper (sin release candidates ni pre-releases). */
export async function listPaperVersions(): Promise<{ id: string; javaMin: number }[]> {
  const v = await versions();
  return v.versions
    .filter((e) => !e.version.id.includes('-'))
    .map((e) => ({ id: e.version.id, javaMin: e.version.java.version.minimum }));
}

export async function getPaperBuild(mc: string): Promise<{ url: string; name: string; loaderVersion: string }> {
  const all = await listPaperVersions();
  if (!all.some((v) => v.id === mc)) throw new Error(`Paper no tiene build para Minecraft ${mc}`);
  const b = await fetchJson<BuildResponse>(`${API}/versions/${mc}/builds/latest`);
  const dl = b.downloads['server:default'] ?? Object.values(b.downloads)[0];
  if (!dl) throw new Error(`Paper ${mc}: la build ${b.id} no tiene descarga`);
  return { url: dl.url, name: dl.name, loaderVersion: String(b.id) };
}
