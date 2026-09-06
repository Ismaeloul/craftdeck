import net from 'node:net';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ServerMeta, serverDir } from './store.js';

/**
 * «Modo dormido»: mientras el servidor de Minecraft está apagado por inactividad,
 * CraftDeck escucha en su puerto hablando lo justo del protocolo de Minecraft:
 *  - al ping de la lista de servidores responde «servidor dormido, entra para arrancarlo»
 *  - a un intento de entrar responde «arrancando, vuelve en un minuto» y despierta el servidor
 * Solo hace falta el handshake, el estado (status/ping) y el primer paquete del login.
 */

const listeners = new Map<string, net.Server>();

/** VarInt de Minecraft: 7 bits por byte, el bit alto indica continuación. */
function readVarInt(buf: Buffer, offset: number): { value: number; size: number } | null {
  let value = 0, size = 0;
  while (size < 5) {
    if (offset + size >= buf.length) return null;
    const b = buf[offset + size]!;
    value |= (b & 0x7f) << (7 * size);
    size++;
    if ((b & 0x80) === 0) return { value, size };
  }
  return null;
}
function writeVarInt(value: number): Buffer {
  const out: number[] = [];
  do {
    let b = value & 0x7f;
    value >>>= 7;
    if (value !== 0) b |= 0x80;
    out.push(b);
  } while (value !== 0);
  return Buffer.from(out);
}
function writeString(s: string): Buffer {
  const data = Buffer.from(s, 'utf8');
  return Buffer.concat([writeVarInt(data.length), data]);
}
function packet(id: number, payload: Buffer): Buffer {
  const body = Buffer.concat([writeVarInt(id), payload]);
  return Buffer.concat([writeVarInt(body.length), body]);
}
function readString(buf: Buffer, offset: number): { value: string; size: number } | null {
  const len = readVarInt(buf, offset);
  if (!len || offset + len.size + len.value > buf.length) return null;
  return { value: buf.subarray(offset + len.size, offset + len.size + len.value).toString('utf8'), size: len.size + len.value };
}

async function favicon(meta: ServerMeta): Promise<string | undefined> {
  try {
    const png = await readFile(path.join(serverDir(meta.id), 'server-icon.png'));
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return undefined;
  }
}

export function isWakeListening(id: string): boolean { return listeners.has(id); }

export function stopWakeListener(id: string): Promise<void> {
  const srv = listeners.get(id);
  if (!srv) return Promise.resolve();
  listeners.delete(id);
  return new Promise((resolve) => srv.close(() => resolve()));
}

/**
 * Empieza a escuchar en el puerto del servidor. `onWake(name)` se llama cuando alguien
 * intenta entrar (ya con el listener cerrado, para que Java pueda coger el puerto).
 */
export async function startWakeListener(meta: ServerMeta, onWake: (player: string) => void, log: (m: string) => void): Promise<void> {
  await stopWakeListener(meta.id);
  const icon = await favicon(meta);
  const motd = `§e§l● §r§eServidor dormido§r §7— entra para arrancarlo\n§8${meta.name} · ${meta.loader} ${meta.mcVersion}`;
  let waking = false;

  const server = net.createServer((sock) => {
    let buf = Buffer.alloc(0);
    let state = 0; // 0 handshake, 1 status, 2 login
    let protocol = 0;
    sock.setTimeout(10_000, () => sock.destroy());
    sock.on('error', () => { /* el cliente cerró */ });
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      // procesar todos los paquetes completos que haya en el buffer
      for (;;) {
        const len = readVarInt(buf, 0);
        if (!len || buf.length < len.size + len.value) return;
        const body = buf.subarray(len.size, len.size + len.value);
        buf = buf.subarray(len.size + len.value);
        const pid = readVarInt(body, 0);
        if (!pid) { sock.destroy(); return; }
        const data = body.subarray(pid.size);
        if (state === 0 && pid.value === 0x00) {
          // Handshake: protocolo, dirección, puerto, siguiente estado
          const pv = readVarInt(data, 0); if (!pv) { sock.destroy(); return; }
          const addr = readString(data, pv.size); if (!addr) { sock.destroy(); return; }
          const next = readVarInt(data, pv.size + addr.size + 2); if (!next) { sock.destroy(); return; }
          protocol = pv.value;
          state = next.value === 2 || next.value === 3 ? 2 : 1;
        } else if (state === 1 && pid.value === 0x00) {
          // Status Request → Status Response (JSON)
          const json = JSON.stringify({
            version: { name: 'Dormido', protocol },
            players: { max: 0, online: 0, sample: [{ name: '§7Entra para arrancar el servidor', id: '00000000-0000-0000-0000-000000000000' }] },
            description: { text: motd },
            ...(icon ? { favicon: icon } : {}),
          });
          sock.write(packet(0x00, writeString(json)));
        } else if (state === 1 && pid.value === 0x01) {
          // Ping → Pong con el mismo payload (8 bytes)
          sock.write(packet(0x01, data.subarray(0, 8)));
          sock.end();
        } else if (state === 2 && pid.value === 0x00) {
          // Login Start: nombre del jugador → desconectar con mensaje y despertar
          const name = readString(data, 0)?.value ?? 'alguien';
          const reason = JSON.stringify({
            text: waking
              ? '§e⏳ El servidor ya está arrancando.\n§7Vuelve a intentarlo en un minuto.'
              : `§a▶ Despertando el servidor por ti, ${name}.\n§7Vuelve a intentarlo en un minuto.`,
          });
          sock.write(packet(0x00, writeString(reason)));
          sock.end();
          if (!waking) {
            waking = true;
            log(`${name} ha llamado a la puerta: despertando el servidor…`);
            void stopWakeListener(meta.id).then(() => onWake(name));
          }
        } else {
          sock.destroy();
          return;
        }
      }
    });
  });
  server.on('error', (err) => {
    log(`No pude escuchar en el puerto ${meta.port} para despertar el servidor: ${err.message}`);
    listeners.delete(meta.id);
  });
  await new Promise<void>((resolve) => server.listen(meta.port, '0.0.0.0', resolve));
  listeners.set(meta.id, server);
  log(`Modo dormido: escuchando en el puerto ${meta.port}; el servidor arrancará cuando alguien intente entrar.`);
}
