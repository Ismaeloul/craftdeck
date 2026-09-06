import { mkdir, writeFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from './paths.js';
import { download, run } from './util.js';
import { getVanillaVersionInfo } from './catalog/vanilla.js';
import { getFabricServer } from './catalog/fabric.js';
import { getForgeInstaller } from './catalog/forge.js';
import { getNeoForgeInstaller } from './catalog/neoforge.js';
import { getPaperBuild } from './catalog/paper.js';
import { ensureJre, pickJavaMajor } from './java.js';
import { ServerMeta, LaunchSpec, updateServer, serverDir, audit } from './store.js';

type Broadcast = (type: string, payload: unknown) => void;

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

/**
 * Aprovisiona un servidor: JRE, jar/installer, eula y server.properties.
 * Corre en segundo plano; el estado va quedando en meta.provision y se emite por WS.
 * También sirve para RE-aprovisionar (cambio de versión de Minecraft): entonces el
 * mundo, mods y server.properties ya existen y se respetan.
 */
export async function provisionServer(meta: ServerMeta, broadcast: Broadcast): Promise<void> {
  const dir = serverDir(meta.id);
  const log = async (msg: string) => {
    meta.provision.log.push(msg);
    await updateServer(meta.id, { provision: meta.provision }).catch(() => {});
    broadcast('provision', { id: meta.id, status: meta.provision.status, msg });
  };

  try {
    await mkdir(dir, { recursive: true });

    // Java lo dicta la versión base de MC (también para loaders modded y Paper)
    const vanillaInfo = await getVanillaVersionInfo(meta.mcVersion);
    const javaMajor = pickJavaMajor(vanillaInfo.javaMajor);
    meta.javaMajor = javaMajor;
    await updateServer(meta.id, { javaMajor });
    await ensureJre(javaMajor, (m) => void log(m));

    const pin = meta.pinnedLoaderVersion;
    let launch: LaunchSpec;
    if (meta.loader === 'vanilla') {
      await log(`Descargando servidor vanilla ${meta.mcVersion}…`);
      await download(vanillaInfo.serverUrl, path.join(dir, 'server.jar'));
      launch = { type: 'jar', jar: 'server.jar' };
    } else if (meta.loader === 'paper') {
      const build = await getPaperBuild(meta.mcVersion);
      meta.loaderVersion = build.loaderVersion;
      await log(`Descargando Paper ${meta.mcVersion} (build ${build.loaderVersion})…`);
      await download(build.url, path.join(dir, 'paper.jar'));
      launch = { type: 'jar', jar: 'paper.jar' };
    } else if (meta.loader === 'fabric') {
      const fab = await getFabricServer(meta.mcVersion, pin);
      meta.loaderVersion = fab.loaderVersion;
      await log(`Descargando servidor Fabric ${meta.mcVersion} (loader ${fab.loaderVersion})…`);
      await download(fab.url, path.join(dir, 'fabric-server.jar'));
      launch = { type: 'jar', jar: 'fabric-server.jar' };
    } else {
      const inst = meta.loader === 'forge'
        ? await getForgeInstaller(meta.mcVersion, pin)
        : await getNeoForgeInstaller(meta.mcVersion, pin);
      meta.loaderVersion = inst.loaderVersion;
      const installerJar = path.join(CACHE_DIR, `${meta.loader}-${meta.mcVersion}-${inst.loaderVersion}-installer.jar`);
      await log(`Descargando installer de ${meta.loader} ${inst.loaderVersion}…`);
      await download(inst.url, installerJar);
      await log('Ejecutando installer (esto tarda un par de minutos)…');
      const java = await ensureJre(javaMajor, (m) => void log(m));
      const code = await run(java, ['-jar', installerJar, '--installServer', dir], {
        cwd: dir,
        onLine: (l) => broadcast('provision', { id: meta.id, status: 'creating', msg: l }),
      });
      if (code !== 0) throw new Error(`El installer de ${meta.loader} terminó con código ${code}`);
      launch = await detectModdedLaunch(dir, meta.loader, inst.loaderVersion);
    }

    await writeFile(path.join(dir, 'eula.txt'), 'eula=true\n');
    // en un re-aprovisionado (cambio de versión) el server.properties del usuario se respeta
    if (!(await exists(path.join(dir, 'server.properties')))) {
      await writeFile(
        path.join(dir, 'server.properties'),
        `server-port=${meta.port}\nmotd=${meta.name} \\u2014 powered by CraftDeck\n`,
      );
    }

    meta.provision.status = 'ready';
    await updateServer(meta.id, { provision: meta.provision, launch, loaderVersion: meta.loaderVersion });
    await log(`Servidor «${meta.name}» listo.`);
    await audit('create', `Preparó el servidor ${meta.name} (${meta.loader} ${meta.mcVersion})`, 'ok');
  } catch (err) {
    meta.provision.status = 'error';
    meta.provision.error = err instanceof Error ? err.message : String(err);
    // si el servidor se borró a medio aprovisionar, updateServer lanza: no dejar promesas sin capturar
    await updateServer(meta.id, { provision: meta.provision }).catch(() => {});
    broadcast('provision', { id: meta.id, status: 'error', msg: meta.provision.error });
    await audit('create', `Falló la preparación de ${meta.name}: ${meta.provision.error}`, 'err');
  }
}

/**
 * Forge/NeoForge moderno deja args en libraries/…; el clásico deja un jar en la raíz.
 * Tras un cambio de versión pueden convivir varias carpetas en libraries/: se elige la
 * de la versión recién instalada.
 */
async function detectModdedLaunch(dir: string, loader: 'forge' | 'neoforge', loaderVersion: string): Promise<LaunchSpec> {
  const vendor = loader === 'forge' ? 'net/minecraftforge/forge' : 'net/neoforged/neoforge';
  const libDir = path.join(dir, 'libraries', ...vendor.split('/'));
  try {
    const versions = await readdir(libDir);
    const pick = versions.find((v) => v.endsWith(`-${loaderVersion}`) || v === loaderVersion) ?? versions[versions.length - 1];
    if (pick) return { type: 'args', argsDir: ['libraries', vendor, pick].join('/') };
  } catch { /* instalación clásica */ }
  const jar = (await readdir(dir)).find(
    (f) => f.startsWith(loader === 'forge' ? 'forge-' : 'neoforge-') && f.endsWith('.jar') && !f.includes('installer'),
  );
  if (!jar) throw new Error(`No se encontró cómo lanzar el servidor ${loader} instalado`);
  return { type: 'jar', jar };
}
