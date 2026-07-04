import { spawn, ChildProcess } from 'node:child_process';
import { mkdir, access, chmod } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './paths.js';
import { download } from './util.js';
import { audit } from './store.js';

// Agente de playit.gg: túnel para que los amigos entren sin abrir puertos.
// Primer arranque: imprime una URL de "claim" que el usuario abre para vincular
// el agente a su cuenta y crear el túnel hacia el puerto del server.

const PLAYIT_DIR = path.join(DATA_DIR, 'playit');

interface PlayitState {
  running: boolean;
  claimUrl: string | null;
  lastLines: string[];
}

let proc: ChildProcess | null = null;
const state: PlayitState = { running: false, claimUrl: null, lastLines: [] };
type Broadcast = (type: string, payload: unknown) => void;
let broadcastFn: Broadcast = () => {};
export function setPlayitBroadcast(fn: Broadcast): void { broadcastFn = fn; }

function binaryInfo(): { url: string; file: string } {
  const base = 'https://github.com/playit-cloud/playit-agent/releases/latest/download';
  if (process.platform === 'win32') return { url: `${base}/playit-windows-x86_64-signed.exe`, file: 'playit.exe' };
  const arch = process.arch === 'arm64' ? 'aarch64' : 'amd64';
  return { url: `${base}/playit-linux-${arch}`, file: 'playit' };
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
  proc = spawn(bin, ['--secret-path', path.join(PLAYIT_DIR, 'playit.toml')], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  state.running = true;
  const onData = (chunk: Buffer) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
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
  proc.on('close', () => {
    proc = null;
    state.running = false;
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
