import { spawn, ChildProcess } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pidusage from 'pidusage';
import { APP_VERSION } from './paths.js';
import { ServerMeta, getServer, listServers, updateServer, serverDir, audit } from './store.js';
import { discordEvent } from './discord.js';
import { latestCrash, pruneCrashReports } from './crashes.js';
import { ensureJre, pickJavaMajor } from './java.js';
import { getVanillaVersionInfo } from './catalog/vanilla.js';
import { recordPlayerEvent } from './players-history.js';
import { prepareBlueMapConfig } from './bluemap.js';
import { startWakeListener, stopWakeListener } from './wake.js';
import { writeFileAtomic } from './util.js';

export type RunStatus = 'offline' | 'starting' | 'online' | 'stopping';
type Broadcast = (type: string, payload: unknown) => void;

export interface OnlinePlayer { name: string; joinedAt: number }

interface Waiter { re: RegExp; resolve: (hit: boolean) => void; timer: NodeJS.Timeout }

interface Instance {
  proc: ChildProcess | null;
  status: RunStatus;
  startedAt: number | null;
  console: string[];
  players: OnlinePlayer[];
  waiters: Waiter[];
  crashTimes: number[]; // cierres inesperados recientes (ventana anti-bucle del watchdog)
  autoRestartTimer: NodeJS.Timeout | null;
  startWarnTimer: NodeJS.Timeout | null;
  emptySince: number | null; // desde cuándo no hay nadie (para el apagado por inactividad)
  sleeping: boolean;         // apagado por inactividad, escuchando en su puerto para despertar
  tps: number | null;        // último TPS leído (Paper)
  tpsPending: boolean;       // hemos pedido «tps» y esperamos la línea de respuesta
  metrics: MetricSample[];   // historial de métricas (una muestra cada 30 s, 24 h)
  metricsLoaded: boolean;
  ticks: number;
}
export interface MetricSample { t: number; cpu: number; mem: number; players: number; tps: number | null }
const METRICS_MAX = 2880; // 24 h a una muestra cada 30 s

// watchdog: reinicia solo tras un crash, pero corta si entra en bucle
const WATCHDOG_WINDOW_MS = 10 * 60_000;
const WATCHDOG_MAX_CRASHES = 3;
const WATCHDOG_RESTART_DELAY_MS = 8_000;

// parada: orden 'stop' → SIGTERM si no guardó a tiempo → SIGKILL si el JVM está colgado
const STOP_TERM_MS = 60_000;
const STOP_KILL_MS = 75_000;

const instances = new Map<string, Instance>();
let broadcastFn: Broadcast = () => {};
export function setBroadcast(fn: Broadcast): void { broadcastFn = fn; }

// operaciones exclusivas por servidor (restaurar backup, etc.): bloquean arrancar/backup/borrar
const busyOps = new Map<string, string>();
export function lockOp(id: string, reason: string): void {
  const cur = busyOps.get(id);
  if (cur) throw new Error(`Hay una operación en curso: ${cur}`);
  busyOps.set(id, reason);
}
export function unlockOp(id: string): void { busyOps.delete(id); }
export function assertNotBusy(id: string): void {
  const cur = busyOps.get(id);
  if (cur) throw new Error(`Hay una operación en curso: ${cur}`);
}

function inst(id: string): Instance {
  let i = instances.get(id);
  if (!i) {
    i = {
      proc: null, status: 'offline', startedAt: null, console: [], players: [],
      waiters: [], crashTimes: [], autoRestartTimer: null, startWarnTimer: null,
      emptySince: null, sleeping: false, tps: null, tpsPending: false, metrics: [], metricsLoaded: false, ticks: 0,
    };
    instances.set(id, i);
  }
  return i;
}

export function runtimeOf(id: string): { status: RunStatus; players: OnlinePlayer[]; uptimeSec: number; sleeping: boolean; tps: number | null } {
  const i = inst(id);
  return {
    status: i.status,
    players: i.players,
    uptimeSec: i.startedAt ? Math.floor((Date.now() - i.startedAt) / 1000) : 0,
    sleeping: i.sleeping,
    tps: i.status === 'online' ? i.tps : null,
  };
}

/** Historial de métricas (CPU, RAM, jugadores, TPS) de las últimas 24 h. */
export async function metricsHistory(id: string): Promise<MetricSample[]> {
  const i = inst(id);
  await loadMetrics(id, i);
  return i.metrics;
}
async function loadMetrics(id: string, i: Instance): Promise<void> {
  if (i.metricsLoaded) return;
  i.metricsLoaded = true;
  try {
    const saved = JSON.parse(await readFile(path.join(serverDir(id), 'craftdeck-metrics.json'), 'utf8')) as MetricSample[];
    const cutoff = Date.now() - 24 * 3600_000;
    i.metrics = [...saved.filter((s) => s.t > cutoff), ...i.metrics].slice(-METRICS_MAX);
  } catch { /* sin historial */ }
}
async function saveMetrics(id: string, i: Instance): Promise<void> {
  try { await writeFileAtomic(path.join(serverDir(id), 'craftdeck-metrics.json'), JSON.stringify(i.metrics)); } catch { /* best-effort */ }
}

export function consoleOf(id: string): string[] {
  return inst(id).console;
}

/**
 * Consola para el panel: el buffer en memoria y, si está vacío (CraftDeck acaba de
 * arrancar), las últimas líneas de logs/latest.log de la sesión anterior.
 */
export async function consoleForPanel(id: string): Promise<string[]> {
  const i = inst(id);
  if (i.console.length) return i.console;
  try {
    const raw = await readFile(path.join(serverDir(id), 'logs', 'latest.log'), 'utf8');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim()).slice(-150);
    if (!lines.length) return [];
    return ['[CraftDeck] Últimas líneas de logs/latest.log (sesión anterior):', ...lines];
  } catch {
    return [];
  }
}

/** Espera a que la consola emita una línea que case con `re` (false si expira o el server muere). */
export function waitForLine(id: string, re: RegExp, timeoutMs: number): Promise<boolean> {
  const i = inst(id);
  if (!i.proc) return Promise.resolve(false);
  return new Promise((resolve) => {
    const w: Waiter = {
      re,
      resolve,
      timer: setTimeout(() => { i.waiters = i.waiters.filter((x) => x !== w); resolve(false); }, timeoutMs),
    };
    i.waiters.push(w);
  });
}

function flushWaiters(i: Instance, line: string | null): void {
  if (!i.waiters.length) return;
  const hit = line === null ? i.waiters : i.waiters.filter((w) => w.re.test(line));
  if (!hit.length) return;
  i.waiters = i.waiters.filter((w) => !hit.includes(w));
  for (const w of hit) { clearTimeout(w.timer); w.resolve(line !== null); }
}

function clearTimers(i: Instance): void {
  if (i.autoRestartTimer) { clearTimeout(i.autoRestartTimer); i.autoRestartTimer = null; }
  if (i.startWarnTimer) { clearTimeout(i.startWarnTimer); i.startWarnTimer = null; }
}

const TPS_RE = /TPS from last 1m, 5m, 15m:\s*\*?([\d.]+)/;

function pushLine(id: string, i: Instance, line: string): void {
  // respuesta a nuestro «tps» silencioso (Paper): se lee y no se enseña
  if (i.tpsPending) {
    const t = line.replace(/\x1b\[[0-9;]*[A-Za-z]|§./g, '').match(TPS_RE);
    if (t) { i.tps = Math.min(20, parseFloat(t[1]!)); i.tpsPending = false; return; }
  }
  i.console.push(line);
  if (i.console.length > 400) i.console.shift();
  broadcastFn('console', { id, line });
  flushWaiters(i, line);

  if (i.status === 'starting' && /Done \([\d.,]+\s*s(econds)?\)!/.test(line)) {
    i.status = 'online';
    i.emptySince = i.players.length ? null : Date.now();
    if (i.startWarnTimer) { clearTimeout(i.startWarnTimer); i.startWarnTimer = null; }
    broadcastFn('status', { id, status: 'online' });
    void discordEvent(id, 'online', 'El servidor está listo para jugar.');
  }
  let m = line.match(/\]:?\s(\S{1,16}) joined the game/);
  if (m) {
    if (!i.players.some((p) => p.name === m![1])) i.players.push({ name: m[1]!, joinedAt: Date.now() });
    i.emptySince = null;
    broadcastFn('players', { id, players: i.players });
    void discordEvent(id, 'join', m[1]!);
    void recordPlayerEvent(id, m[1]!, 'join');
  }
  m = line.match(/\]:?\s(\S{1,16}) left the game/);
  if (m) {
    i.players = i.players.filter((p) => p.name !== m![1]);
    if (!i.players.length) i.emptySince = Date.now();
    broadcastFn('players', { id, players: i.players });
    void discordEvent(id, 'leave', m[1]!);
    void recordPlayerEvent(id, m[1]!, 'leave');
  }
  m = line.match(/\]:?\s<(\S{1,16})> (.*)$/);
  if (m) void discordEvent(id, 'chat', `**${m[1]}** ${m[2]}`);
}

/**
 * Flags de Aikar (https://mcflags.emc.gs): G1GC afinado para servidores de Minecraft.
 * Menos tirones de lag con la misma RAM. Los valores cambian a partir de 12 GB de heap.
 */
export function aikarFlags(memoryMb: number): string[] {
  const big = memoryMb >= 12 * 1024;
  return [
    '-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=200',
    '-XX:+UnlockExperimentalVMOptions', '-XX:+DisableExplicitGC',
    `-XX:G1NewSizePercent=${big ? 40 : 30}`, `-XX:G1MaxNewSizePercent=${big ? 50 : 40}`,
    `-XX:G1HeapRegionSize=${big ? 16 : 8}M`, `-XX:G1ReservePercent=${big ? 15 : 20}`,
    '-XX:G1HeapWastePercent=5', '-XX:G1MixedGCCountTarget=4',
    `-XX:InitiatingHeapOccupancyPercent=${big ? 20 : 15}`, '-XX:G1MixedGCLiveThresholdPercent=90',
    '-XX:G1RSetUpdatingPauseTimePercent=5', '-XX:SurvivorRatio=32', '-XX:+PerfDisableSharedMem',
    '-XX:MaxTenuringThreshold=1', '-Dusing.aikars.flags=https://mcflags.emc.gs', '-Daikars.new.flags=true',
  ];
}

function launchArgs(meta: ServerMeta): string[] {
  const jvm = [`-Xmx${meta.memoryMb}M`];
  if (meta.aikarFlags !== false) {
    // Aikar recomienda Xms = Xmx; sin AlwaysPreTouch Linux no reserva la RAM física hasta usarla
    jvm.push(`-Xms${meta.memoryMb}M`, ...aikarFlags(meta.memoryMb));
  }
  // limita cuántos núcleos ve Java (0 o ausente = todos)
  if (meta.cpuCores && meta.cpuCores > 0) jvm.push(`-XX:ActiveProcessorCount=${meta.cpuCores}`);
  if (meta.launch!.type === 'jar') {
    return [...jvm, '-jar', meta.launch!.jar, 'nogui'];
  }
  const argsFile = path.join(
    ...meta.launch!.argsDir.split('/'),
    process.platform === 'win32' ? 'win_args.txt' : 'unix_args.txt',
  );
  return [...jvm, `@${argsFile}`, 'nogui'];
}

/** Recuerda si el servidor «debería estar encendido» (para volver a levantarlo tras reiniciar el Umbrel). */
async function setDesiredRunning(id: string, on: boolean): Promise<void> {
  try {
    const meta = await getServer(id);
    if (!meta || (meta.desiredRunning ?? false) === on) return;
    await updateServer(id, { desiredRunning: on });
  } catch { /* el servidor se está borrando */ }
}

/** Cierre inesperado: analiza el crash, avisa con el culpable y programa el auto-reinicio si procede. */
async function handleCrash(id: string, i: Instance, meta: ServerMeta, code: number | null, startedAt: number | null): Promise<void> {
  const now = Date.now();
  i.crashTimes = i.crashTimes.filter((t) => now - t < WATCHDOG_WINDOW_MS);
  i.crashTimes.push(now);
  const attempt = i.crashTimes.length;

  const oomHint = code === null ? ' El sistema mató el proceso (¿se quedó el Umbrel sin memoria? prueba a bajar la RAM asignada).' : '';
  const crash = await latestCrash(id, (startedAt ?? now) - 60_000).catch(() => null);
  void pruneCrashReports(id).catch(() => {}); // que crash-reports/ no crezca sin límite
  const culpritTxt = crash && crash.culprit !== 'Desconocido' ? ` Culpable probable: «${crash.culprit}».` : '';

  const autoRestart = meta.autoRestart !== false;
  const willRestart = autoRestart && attempt <= WATCHDOG_MAX_CRASHES;

  broadcastFn('status', {
    id, status: 'offline', crashed: true,
    culprit: crash?.culprit, willRestart, attempt, maxAttempts: WATCHDOG_MAX_CRASHES,
  });
  void audit('alert', `${meta.name} se cerró inesperadamente (código ${code})${culpritTxt}`, 'err');

  if (willRestart) {
    pushLine(id, i, `[CraftDeck] Reinicio automático en ${WATCHDOG_RESTART_DELAY_MS / 1000} s (crash ${attempt}/${WATCHDOG_MAX_CRASHES} en 10 min).${culpritTxt}`);
    void discordEvent(id, 'crash', `Terminó inesperadamente (código ${code}).${oomHint}${culpritTxt} Reinicio automático en marcha (${attempt}/${WATCHDOG_MAX_CRASHES}).`);
    i.autoRestartTimer = setTimeout(() => {
      i.autoRestartTimer = null;
      startServer(id).catch((err) => {
        pushLine(id, i, `[CraftDeck] El reinicio automático falló: ${err instanceof Error ? err.message : err}`);
      });
    }, WATCHDOG_RESTART_DELAY_MS);
  } else if (autoRestart) {
    pushLine(id, i, `[CraftDeck] ${attempt} crashes en 10 minutos: pauso el reinicio automático para no entrar en bucle. Mira Diagnóstico.${culpritTxt}`);
    void discordEvent(id, 'crash', `⚠️ Crash en bucle: ${attempt} caídas en 10 minutos, dejo el servidor apagado.${culpritTxt} Entra en Diagnóstico y desactiva el mod culpable.`);
    void audit('alert', `${meta.name} entró en bucle de crashes; auto-reinicio pausado`, 'err');
    void setDesiredRunning(id, false); // que un reinicio del Umbrel no reanude el bucle
  } else {
    void discordEvent(id, 'crash', `Terminó inesperadamente (código ${code}).${oomHint}${culpritTxt} El reinicio automático está desactivado; mira Diagnóstico en el panel.`);
  }
}

export async function startServer(id: string): Promise<void> {
  const meta = await getServer(id);
  if (!meta) throw new Error('Servidor no encontrado');
  if (meta.provision.status !== 'ready' || !meta.launch) throw new Error('El servidor aún no está aprovisionado');
  assertNotBusy(id);
  const i = inst(id);
  if (i.proc) throw new Error('El servidor ya está en marcha');
  clearTimers(i); // un arranque manual cancela cualquier reinicio automático pendiente
  // si estaba dormido, soltar el puerto para que lo coja Java
  await stopWakeListener(id);
  if (i.sleeping || meta.sleeping) { i.sleeping = false; await updateServer(id, { sleeping: false }).catch(() => {}); }
  i.tps = null; i.tpsPending = false;

  // recalcular el Java requerido en cada arranque: corrige metas antiguas con un major insuficiente
  let javaMajor = meta.javaMajor;
  try {
    const wanted = pickJavaMajor((await getVanillaVersionInfo(meta.mcVersion)).javaMajor);
    if (wanted !== javaMajor) {
      javaMajor = wanted;
      meta.javaMajor = wanted;
      await updateServer(id, { javaMajor: wanted });
    }
  } catch (err) {
    pushLine(id, i, `[CraftDeck] Aviso: no pude verificar el Java requerido (${err instanceof Error ? err.message : err}); uso Java ${javaMajor}`);
  }
  const java = await ensureJre(javaMajor, (m) => pushLine(id, i, `[CraftDeck] ${m}`));
  if (i.proc) throw new Error('El servidor ya está en marcha'); // otro arranque ganó mientras descargábamos Java
  // si BlueMap está instalado, dejarle la config hecha antes de que arranque (puerto local, descarga aceptada)
  await prepareBlueMapConfig(meta).catch((err) => pushLine(id, i, `[CraftDeck] Aviso: no pude preparar BlueMap: ${err instanceof Error ? err.message : err}`));
  i.status = 'starting';
  i.startedAt = Date.now();
  i.players = [];
  broadcastFn('status', { id, status: 'starting' });
  pushLine(id, i, `[CraftDeck v${APP_VERSION}] Arrancando ${meta.name} (${meta.loader} ${meta.mcVersion}, ${meta.memoryMb} MB, Java ${javaMajor}${meta.aikarFlags === false ? '' : ', flags de Aikar'})…`);

  const proc = spawn(java, launchArgs(meta), { cwd: serverDir(id), stdio: ['pipe', 'pipe', 'pipe'] });
  i.proc = proc;
  void setDesiredRunning(id, true);

  i.startWarnTimer = setTimeout(() => {
    if (i.status === 'starting') {
      pushLine(id, i, '[CraftDeck] El servidor lleva 15 minutos arrancando; algo no va bien. Puedes detenerlo con el botón Detener.');
    }
  }, 15 * 60_000);

  let buf = '';
  const onData = (chunk: Buffer) => {
    buf += chunk.toString();
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).replace(/\r$/, '');
      buf = buf.slice(nl + 1);
      if (line.trim()) pushLine(id, i, line);
    }
  };
  proc.stdout!.on('data', onData);
  proc.stderr!.on('data', onData);

  proc.on('close', (code) => {
    const wasStopping = i.status === 'stopping';
    const crashed = !wasStopping && code !== 0;
    const startedAt = i.startedAt;
    i.proc = null;
    i.status = 'offline';
    i.startedAt = null;
    i.players = [];
    if (i.startWarnTimer) { clearTimeout(i.startWarnTimer); i.startWarnTimer = null; }
    flushWaiters(i, null);
    pushLine(id, i, crashed
      ? `[CraftDeck] El servidor terminó inesperadamente (código ${code})`
      : '[CraftDeck] Servidor detenido.');
    if (crashed) {
      void handleCrash(id, i, meta, code, startedAt);
    } else {
      broadcastFn('status', { id, status: 'offline' });
      void discordEvent(id, 'offline', 'Servidor detenido correctamente.');
    }
  });
  proc.on('error', (err) => {
    pushLine(id, i, `[CraftDeck] Error lanzando Java: ${err.message}`);
  });

  await audit('play', `Inició el servidor ${meta.name}`, 'ok');
}

/**
 * Detiene el servidor. Un stop «deliberado» (botón, tarea programada, borrado) apaga también
 * el deseo de estar encendido; el apagado de CraftDeck entero (`keepDesired`) no, para que
 * al volver el Umbrel se levante solo.
 */
export function stopServer(id: string, opts: { keepDesired?: boolean; sleep?: boolean } = {}): Promise<void> {
  const i = inst(id);
  clearTimers(i); // un stop manual también cancela el reinicio automático pendiente
  if (!opts.keepDesired) void setDesiredRunning(id, false);
  // un stop deliberado también saca al servidor del modo dormido (deja de escuchar en el puerto)
  if (!opts.keepDesired && !opts.sleep) void leaveSleep(id);
  const proc = i.proc;
  if (!proc) return Promise.resolve();
  i.status = 'stopping';
  broadcastFn('status', { id, status: 'stopping' });
  try {
    proc.stdin!.write('stop\n');
  } catch {
    proc.kill(); // stdin roto (JVM zombi): directo a señales
  }
  return new Promise((resolve) => {
    const term = setTimeout(() => proc.kill('SIGTERM'), STOP_TERM_MS);
    const kill = setTimeout(() => proc.kill('SIGKILL'), STOP_KILL_MS);
    proc.once('close', () => { clearTimeout(term); clearTimeout(kill); resolve(); });
  });
}

export function sendCommand(id: string, cmd: string, opts: { silent?: boolean } = {}): void {
  const i = inst(id);
  if (!i.proc || i.status === 'offline') throw new Error('El servidor no está en marcha');
  i.proc.stdin!.write(cmd + '\n');
  if (!opts.silent) pushLine(id, i, `> ${cmd}`);
}

/* ---------- modo dormido: apagado por inactividad + despertar al conectar ---------- */

/** Apaga por inactividad y se queda escuchando en el puerto (si wakeOnConnect no está apagado). */
async function idleStop(meta: ServerMeta, i: Instance): Promise<void> {
  const mins = meta.idleStopMinutes ?? 0;
  pushLine(meta.id, i, `[CraftDeck] ${mins} minutos sin nadie: apago el servidor para liberar RAM.${meta.wakeOnConnect === false ? '' : ' Se despertará cuando alguien intente entrar.'}`);
  await audit('power', `${meta.name} se apagó por inactividad (${mins} min sin jugadores)`, 'info');
  await stopServer(meta.id, { sleep: true });
  await enterSleep(meta);
}

/** Marca el servidor como dormido y, si procede, pone el listener que lo despierta. */
export async function enterSleep(meta: ServerMeta): Promise<void> {
  const i = inst(meta.id);
  if (i.proc) return;
  i.sleeping = true;
  await updateServer(meta.id, { sleeping: true, desiredRunning: false }).catch(() => {});
  broadcastFn('status', { id: meta.id, status: 'offline', sleeping: true });
  if (meta.wakeOnConnect === false) return;
  await startWakeListener(meta, (player) => {
    void audit('play', `${player} despertó el servidor ${meta.name} al intentar entrar`, 'ok');
    startServer(meta.id).catch((err) => pushLine(meta.id, i, `[CraftDeck] No pude despertar el servidor: ${err instanceof Error ? err.message : err}`));
  }, (m) => pushLine(meta.id, i, `[CraftDeck] ${m}`));
}

async function leaveSleep(id: string): Promise<void> {
  const i = inst(id);
  await stopWakeListener(id);
  if (i.sleeping) {
    i.sleeping = false;
    await updateServer(id, { sleeping: false }).catch(() => {});
  }
}

/** Al borrar un servidor: soltar su puerto si estaba dormido. */
export async function forgetServer(id: string): Promise<void> {
  await stopWakeListener(id);
  instances.delete(id);
}

// cada 30 s: ¿algún servidor lleva demasiado tiempo vacío?
setInterval(() => {
  void (async () => {
    for (const meta of await listServers()) {
      const i = instances.get(meta.id);
      if (!i || i.status !== 'online' || i.players.length || !meta.idleStopMinutes) continue;
      if (!i.emptySince) { i.emptySince = Date.now(); continue; }
      if (Date.now() - i.emptySince >= meta.idleStopMinutes * 60_000) await idleStop(meta, i).catch((err) => console.error('[idle]', err));
    }
  })();
}, 30_000);

/** Anuncio visible para todos los jugadores en el chat del juego. */
export function announceInGame(id: string, text: string): void {
  sendCommand(id, `tellraw @a ["",{"text":"⚙ CraftDeck · ","color":"aqua"},{"text":${JSON.stringify(text)},"color":"yellow"}]`);
}

export function anyRunning(): boolean {
  return [...instances.values()].some((i) => i.proc);
}

/** Apagado de CraftDeck: para todos los servidores sin olvidar que deberían estar encendidos. */
export async function stopAll(): Promise<void> {
  await Promise.all([...instances.keys()].map((id) => stopServer(id, { keepDesired: true })));
}

/** Suma de la RAM asignada a los servidores que están en marcha (para los avisos de memoria). */
export async function runningMemoryMb(exceptId?: string): Promise<number> {
  let total = 0;
  for (const meta of await listServers()) {
    if (meta.id !== exceptId && inst(meta.id).proc) total += meta.memoryMb;
  }
  return total;
}

/**
 * Al arrancar CraftDeck (reinicio del Umbrel, actualización de la app): vuelve a levantar
 * los servidores que estaban encendidos, de uno en uno para no descargar Java en paralelo.
 */
export async function autoStartServers(): Promise<void> {
  // los que se durmieron por inactividad vuelven a escuchar en su puerto
  for (const meta of await listServers()) {
    if (meta.provision.status === 'ready' && meta.sleeping && !meta.desiredRunning) {
      await enterSleep(meta).catch((err) => console.error('[sleep]', err));
    }
  }
  const pending = (await listServers()).filter((m) =>
    m.provision.status === 'ready' && m.desiredRunning && m.autoStart !== false);
  if (!pending.length) return;
  console.log(`[craftdeck] auto-arranque: ${pending.map((m) => m.name).join(', ')}`);
  for (const meta of pending) {
    try {
      pushLine(meta.id, inst(meta.id), '[CraftDeck] CraftDeck se ha reiniciado: vuelvo a arrancar el servidor porque estaba encendido.');
      await startServer(meta.id);
      await audit('play', `Arrancó ${meta.name} automáticamente tras reiniciar CraftDeck`, 'info');
    } catch (err) {
      console.error(`[craftdeck] auto-arranque de ${meta.name}:`, err);
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

// métricas de proceso cada 3 s para los servidores en marcha; cada 30 s se guarda una muestra
// en el historial de 24 h y cada 60 s se pide el TPS a Paper (en silencio)
setInterval(() => {
  void (async () => {
    const metas = await listServers();
    for (const [id, i] of instances) {
      if (!i.proc?.pid) continue;
      i.ticks++;
      const meta = metas.find((m) => m.id === id);
      if (meta?.loader === 'paper' && i.status === 'online' && i.ticks % 20 === 0) {
        try { i.tpsPending = true; sendCommand(id, 'tps', { silent: true }); } catch { i.tpsPending = false; }
        setTimeout(() => { i.tpsPending = false; }, 5000); // si no contesta, no dejar el filtro colgado
      }
      pidusage(i.proc.pid)
        .then(async (s) => {
          const cpu = Math.round(s.cpu * 10) / 10;
          const memMb = Math.round(s.memory / 1048576);
          broadcastFn('metrics', {
            id, cpu, memMb,
            uptimeSec: i.startedAt ? Math.floor((Date.now() - i.startedAt) / 1000) : 0,
            players: i.players.length,
            tps: i.status === 'online' ? i.tps : null,
          });
          if (i.ticks % 10 === 0) {
            await loadMetrics(id, i);
            i.metrics.push({ t: Date.now(), cpu, mem: memMb, players: i.players.length, tps: i.tps });
            if (i.metrics.length > METRICS_MAX) i.metrics.splice(0, i.metrics.length - METRICS_MAX);
            if (i.ticks % 100 === 0) await saveMetrics(id, i);
          }
        })
        .catch(() => { /* el proceso acaba de morir */ });
    }
  })();
}, 3000);
