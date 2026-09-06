import { spawn, ChildProcess } from 'node:child_process';
import { mkdir, access, chmod, readFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './paths.js';
import { download, writeFileAtomic } from './util.js';
import { audit } from './store.js';

// Agente de playit.gg: túnel para que los amigos entren sin abrir puertos.
// Primer arranque: imprime una URL de "claim" que el usuario abre para vincular
// el agente a su cuenta y crear el túnel hacia el puerto del server.

const PLAYIT_DIR = path.join(DATA_DIR, 'playit');
const SETTINGS_FILE = path.join(PLAYIT_DIR, 'settings.json');

interface PlayitState {
  running: boolean;
  claimUrl: string | null;
  lastLines: string[];
  autoStart: boolean; // arrancar el agente solo cuando arranca CraftDeck
}

let proc: ChildProcess | null = null;
const state: PlayitState = { running: false, claimUrl: null, lastLines: [], autoStart: false };

async function loadSettings(): Promise<void> {
  try {
    const s = JSON.parse(await readFile(SETTINGS_FILE, 'utf8')) as { autoStart?: boolean };
    state.autoStart = !!s.autoStart;
  } catch { /* primera vez */ }
}
async function saveSettings(): Promise<void> {
  await mkdir(PLAYIT_DIR, { recursive: true });
  await writeFileAtomic(SETTINGS_FILE, JSON.stringify({ autoStart: state.autoStart }, null, 2));
}

export async function setPlayitAutoStart(on: boolean): Promise<void> {
  state.autoStart = on;
  await saveSettings();
  await audit('wifi', on ? 'playit.gg arrancará solo con CraftDeck' : 'playit.gg ya no arranca solo', 'info');
}

/** Al arrancar CraftDeck: levanta el agente si el usuario lo dejó en auto. */
export async function initPlayit(): Promise<void> {
  await loadSettings();
  if (!state.autoStart) return;
  try {
    await startPlayit();
    console.log('[craftdeck] túnel playit.gg arrancado automáticamente');
  } catch (err) {
    console.error('[craftdeck] auto-arranque de playit:', err);
  }
}
type Broadcast = (type: string, payload: unknown) => void;
let broadcastFn: Broadcast = () => {};
export function setPlayitBroadcast(fn: Broadcast): void { broadcastFn = fn; }

// Fijado al agente clásico 0.15: el 1.x es un demonio (playitd) que ya no imprime
// la URL de claim por sí solo — espera a un frontend por IPC que aquí no existe.
const PLAYIT_VERSION = '0.15.26';

function binaryInfo(): { url: string; file: string } {
  const base = `https://github.com/playit-cloud/playit-agent/releases/download/v${PLAYIT_VERSION}`;
  if (process.platform === 'win32') return { url: `${base}/playit-windows-x86_64-signed.exe`, file: `playit-${PLAYIT_VERSION}.exe` };
  const arch = process.arch === 'arm64' ? 'aarch64' : 'amd64';
  return { url: `${base}/playit-linux-${arch}`, file: `playit-${PLAYIT_VERSION}` };
}

async function ensureBinary(): Promise<string> {
  const { url, file } = binaryInfo();
  const bin = path.join(PLAYIT_DIR, file);
  try { await access(bin); return bin; } catch { /* descargar */ }
  await mkdir(PLAYIT_DIR, { recursive: true });
  await download(url, bin);
  if (process.platform !== 'win32') await chmod(bin, 0o755);
  return bin;
}

export function playitStatus(): PlayitState {
  return { ...state, lastLines: state.lastLines.slice(-15) };
}

export async function startPlayit(): Promise<void> {
  if (proc) throw new Error('El agente de playit ya está en marcha');
  const bin = await ensureBinary();
  state.claimUrl = null;
  state.lastLines = [];
  proc = spawn(bin, ['--secret_path', path.join(PLAYIT_DIR, 'playit.toml')], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  state.running = true;
  const onData = (chunk: Buffer) => {
    for (const raw of chunk.toString().split(/\r?\n/)) {
      const line = raw.replace(/\x1b\[[0-9;]*[A-Za-z]/g, ''); // fuera códigos ANSI de color
      if (!line.trim()) continue;
      state.lastLines.push(line);
      if (state.lastLines.length > 60) state.lastLines.shift();
      const claim = line.match(/https:\/\/playit\.gg\/claim\/[\w-]+/);
      if (claim && state.claimUrl !== claim[0]) {
        state.claimUrl = claim[0];
        broadcastFn('playit', { claimUrl: state.claimUrl, running: true });
      }
    }
  };
  proc.stdout!.on('data', onData);
  proc.stderr!.on('data', onData);
  proc.on('close', (code) => {
    proc = null;
    state.running = false;
    if (code !== null && code !== 0) state.lastLines.push(`[playit] el agente terminó con código ${code}`);
    broadcastFn('playit', { running: false });
  });
  proc.on('error', (err) => {
    state.lastLines.push(`[playit] error: ${err.message}`);
  });
  await audit('wifi', 'Arrancó el túnel de playit.gg', 'ok');
}

export async function stopPlayit(): Promise<void> {
  if (!proc) return;
  proc.kill();
  await audit('wifi', 'Detuvo el túnel de playit.gg', 'warn');
}
