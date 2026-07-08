import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import pidusage from 'pidusage';
import { APP_VERSION } from './paths.js';
import { ServerMeta, getServer, updateServer, serverDir, audit } from './store.js';
import { discordEvent } from './discord.js';
import { latestCrash } from './crashes.js';
import { ensureJre, pickJavaMajor } from './java.js';
import { getVanillaVersionInfo } from './catalog/vanilla.js';

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
}

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
    };
    instances.set(id, i);
  }
  return i;
}

export function runtimeOf(id: string): { status: RunStatus; players: OnlinePlayer[]; uptimeSec: number } {
  const i = inst(id);
  return {
    status: i.status,
    players: i.players,
    uptimeSec: i.startedAt ? Math.floor((Date.now() - i.startedAt) / 1000) : 0,
  };
}

export function consoleOf(id: string): string[] {
  return inst(id).console;
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

function pushLine(id: string, i: Instance, line: string): void {
  i.console.push(line);
  if (i.console.length > 400) i.console.shift();
  broadcastFn('console', { id, line });
  flushWaiters(i, line);

  if (i.status === 'starting' && /Done \([\d.,]+\s*s(econds)?\)!/.test(line)) {
    i.status = 'online';
    if (i.startWarnTimer) { clearTimeout(i.startWarnTimer); i.startWarnTimer = null; }
    broadcastFn('status', { id, status: 'online' });
    void discordEvent(id, 'online', 'El servidor está listo para jugar.');
  }
  let m = line.match(/\]:?\s(\S{1,16}) joined the game/);
  if (m) {
    if (!i.players.some((p) => p.name === m![1])) i.players.push({ name: m[1]!, joinedAt: Date.now() });
    broadcastFn('players', { id, players: i.players });
    void discordEvent(id, 'join', m[1]!);
  }
  m = line.match(/\]:?\s(\S{1,16}) left the game/);
  if (m) {
    i.players = i.players.filter((p) => p.name !== m![1]);
    broadcastFn('players', { id, players: i.players });
    void discordEvent(id, 'leave', m[1]!);
  }
  m = line.match(/\]:?\s<(\S{1,16})> (.*)$/);
  if (m) void discordEvent(id, 'chat', `**${m[1]}** ${m[2]}`);
}

function launchArgs(meta: ServerMeta): string[] {
  const jvm = [`-Xmx${meta.memoryMb}M`];
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

/** Cierre inesperado: analiza el crash, avisa con el culpable y programa el auto-reinicio si procede. */
async function handleCrash(id: string, i: Instance, meta: ServerMeta, code: number | null, startedAt: number | null): Promise<void> {
  const now = Date.now();
  i.crashTimes = i.crashTimes.filter((t) => now - t < WATCHDOG_WINDOW_MS);
  i.crashTimes.push(now);
  const attempt = i.crashTimes.length;

  const oomHint = code === null ? ' El sistema mató el proceso (¿se quedó el Umbrel sin memoria? prueba a bajar la RAM asignada).' : '';
  const crash = await latestCrash(id, (startedAt ?? now) - 60_000).catch(() => null);
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
  i.status = 'starting';
  i.startedAt = Date.now();
  i.players = [];
  broadcastFn('status', { id, status: 'starting' });
  pushLine(id, i, `[CraftDeck v${APP_VERSION}] Arrancando ${meta.name} (${meta.loader} ${meta.mcVersion}, ${meta.memoryMb} MB, Java ${javaMajor})…`);

  const proc = spawn(java, launchArgs(meta), { cwd: serverDir(id), stdio: ['pipe', 'pipe', 'pipe'] });
  i.proc = proc;

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

export function stopServer(id: string): Promise<void> {
  const i = inst(id);
  clearTimers(i); // un stop manual también cancela el reinicio automático pendiente
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

export function sendCommand(id: string, cmd: string): void {
  const i = inst(id);
  if (!i.proc || i.status === 'offline') throw new Error('El servidor no está en marcha');
  i.proc.stdin!.write(cmd + '\n');
  pushLine(id, i, `> ${cmd}`);
}

/** Anuncio visible para todos los jugadores en el chat del juego. */
export function announceInGame(id: string, text: string): void {
  sendCommand(id, `tellraw @a ["",{"text":"⚙ CraftDeck · ","color":"aqua"},{"text":${JSON.stringify(text)},"color":"yellow"}]`);
}

export function anyRunning(): boolean {
  return [...instances.values()].some((i) => i.proc);
}

export async function stopAll(): Promise<void> {
  await Promise.all([...instances.keys()].map((id) => stopServer(id)));
}

// métricas de proceso cada 3 s para los servidores en marcha
setInterval(() => {
  for (const [id, i] of instances) {
    if (!i.proc?.pid) continue;
    pidusage(i.proc.pid)
      .then((s) => broadcastFn('metrics', {
        id,
        cpu: Math.round(s.cpu * 10) / 10,
        memMb: Math.round(s.memory / 1048576),
        uptimeSec: i.startedAt ? Math.floor((Date.now() - i.startedAt) / 1000) : 0,
        players: i.players.length,
      }))
      .catch(() => { /* el proceso acaba de morir */ });
  }
}, 3000);
