import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import cron, { type ScheduledTask } from 'node-cron';
import { DATA_DIR } from './paths.js';
import { writeFileAtomic } from './util.js';
import { audit } from './store.js';
import { runtimeOf, startServer, stopServer, sendCommand, announceInGame } from './instance.js';

export type EventType = 'restart' | 'announce' | 'command' | 'start' | 'stop';

export interface Schedule {
  kind: 'daily' | 'weekly' | 'interval';
  time?: string;        // "HH:MM" para daily/weekly
  days?: number[];      // 0=domingo … 6=sábado, para weekly
  everyMinutes?: number; // para interval
}

export interface EventTask {
  id: string;
  serverId: string;
  type: EventType;
  payload: string; // mensaje (announce) o comando (command); vacío para el resto
  schedule: Schedule;
  enabled: boolean;
}

const FILE = path.join(DATA_DIR, 'events.json');
const jobs = new Map<string, ScheduledTask>();
let tasks: EventTask[] | null = null;

async function load(): Promise<EventTask[]> {
  if (tasks) return tasks;
  try { tasks = JSON.parse(await readFile(FILE, 'utf8')); } catch { tasks = []; }
  return tasks!;
}
async function persist(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFileAtomic(FILE, JSON.stringify(tasks ?? [], null, 2));
}

function toCron(s: Schedule): string {
  if (s.kind === 'interval') {
    const n = Math.min(Math.max(s.everyMinutes ?? 60, 5), 1440);
    return n < 60 ? `*/${n} * * * *` : `0 */${Math.round(n / 60)} * * *`;
  }
  const [h, m] = (s.time ?? '06:00').split(':').map(Number);
  if (s.kind === 'weekly') return `${m} ${h} * * ${(s.days?.length ? s.days : [0]).join(',')}`;
  return `${m} ${h} * * *`;
}

/** Próxima ejecución aproximada, para mostrar en la UI. */
export function nextRun(s: Schedule): string {
  const now = new Date();
  const next = new Date(now);
  if (s.kind === 'interval') {
    const n = Math.min(Math.max(s.everyMinutes ?? 60, 5), 1440);
    next.setMinutes(now.getMinutes() + (n - (now.getMinutes() % n)), 0, 0);
    return next.toISOString();
  }
  const [h, m] = (s.time ?? '06:00').split(':').map(Number);
  next.setHours(h!, m!, 0, 0);
  const days = s.kind === 'weekly' ? (s.days?.length ? s.days : [0]) : [0, 1, 2, 3, 4, 5, 6];
  for (let add = 0; add < 8; add++) {
    const cand = new Date(next);
    cand.setDate(next.getDate() + add);
    if (cand > now && days.includes(cand.getDay())) return cand.toISOString();
  }
  return next.toISOString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function restartWithCountdown(serverId: string): Promise<void> {
  if (runtimeOf(serverId).status !== 'online') return;
  announceInGame(serverId, 'Reinicio programado en 5 minutos');
  await sleep(4 * 60_000);
  if (runtimeOf(serverId).status !== 'online') return;
  announceInGame(serverId, 'Reinicio en 1 minuto — busca un sitio seguro');
  await sleep(50_000);
  if (runtimeOf(serverId).status !== 'online') return;
  announceInGame(serverId, 'Reinicio en 10 segundos…');
  await sleep(10_000);
  if (runtimeOf(serverId).status !== 'online') return;
  await stopServer(serverId);
  await startServer(serverId);
}

async function execute(task: EventTask): Promise<void> {
  try {
    const online = runtimeOf(task.serverId).status === 'online';
    switch (task.type) {
      case 'announce':
        if (online) announceInGame(task.serverId, task.payload);
        break;
      case 'command':
        if (online) sendCommand(task.serverId, task.payload);
        break;
      case 'restart':
        await restartWithCountdown(task.serverId);
        break;
      case 'start':
        if (!online) await startServer(task.serverId);
        break;
      case 'stop':
        if (online) {
          announceInGame(task.serverId, 'El servidor se apagará en 1 minuto');
          await sleep(60_000);
          if (runtimeOf(task.serverId).status === 'online') await stopServer(task.serverId);
        }
        break;
    }
    await audit('calendar', `Tarea programada ejecutada: ${describeTask(task)}`, 'info');
  } catch (err) {
    console.error('[events]', task.id, err);
  }
}

export function describeTask(t: EventTask): string {
  switch (t.type) {
    case 'restart': return 'Reinicio programado (con avisos)';
    case 'announce': return `Anuncio: «${t.payload}»`;
    case 'command': return `Comando: /${t.payload}`;
    case 'start': return 'Encender el servidor';
    case 'stop': return 'Apagar el servidor (avisa 1 min antes)';
  }
}

function register(task: EventTask): void {
  unregister(task.id);
  if (!task.enabled) return;
  jobs.set(task.id, cron.schedule(toCron(task.schedule), () => void execute(task)));
}
function unregister(id: string): void {
  jobs.get(id)?.stop();
  jobs.delete(id);
}

export async function listEvents(serverId: string): Promise<(EventTask & { next: string })[]> {
  return (await load())
    .filter((t) => t.serverId === serverId)
    .map((t) => ({ ...t, next: nextRun(t.schedule) }));
}

export async function addEvent(serverId: string, type: EventType, payload: string, schedule: Schedule): Promise<EventTask> {
  const task: EventTask = { id: crypto.randomUUID().slice(0, 8), serverId, type, payload, schedule, enabled: true };
  (await load()).push(task);
  await persist();
  register(task);
  await audit('plus', `Creó una tarea programada: ${describeTask(task)}`, 'ok');
  return task;
}

export async function toggleEvent(serverId: string, id: string, enabled: boolean): Promise<void> {
  const task = (await load()).find((t) => t.id === id && t.serverId === serverId);
  if (!task) throw new Error('Tarea no encontrada');
  task.enabled = enabled;
  await persist();
  register(task);
}

export async function deleteEvent(serverId: string, id: string): Promise<void> {
  const all = await load();
  const task = all.find((t) => t.id === id && t.serverId === serverId);
  if (!task) throw new Error('Tarea no encontrada');
  tasks = all.filter((t) => t !== task);
  await persist();
  unregister(id);
  await audit('trash', `Eliminó la tarea: ${describeTask(task)}`, 'warn');
}

export async function removeEventsOfServer(serverId: string): Promise<void> {
  const all = await load();
  for (const t of all.filter((t) => t.serverId === serverId)) unregister(t.id);
  tasks = all.filter((t) => t.serverId !== serverId);
  await persist();
}

export async function initEvents(): Promise<void> {
  for (const task of await load()) register(task);
}
