import { getServer, ServerMeta } from './store.js';

export interface DiscordConfig {
  url: string;
  onStatus: boolean;   // encendido / apagado / crash
  onPlayers: boolean;  // entra / sale
  onBackup: boolean;
  chatMirror: boolean; // espejo del chat del juego
}

const COLORS = { ok: 0x34d399, warn: 0xfbbf24, err: 0xf87171, info: 0x60a5fa };

// cola con lotes para no comerse el rate-limit del webhook (30 req/min)
const queue = new Map<string, string[]>(); // url -> líneas pendientes
let flusher: NodeJS.Timeout | null = null;

function enqueue(url: string, line: string): void {
  const list = queue.get(url) ?? [];
  list.push(line);
  if (list.length > 25) list.shift();
  queue.set(url, list);
  flusher ??= setInterval(() => void flush(), 3000);
}

async function flush(): Promise<void> {
  for (const [url, lines] of queue) {
    queue.delete(url);
    if (!lines.length) continue;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: lines.join('\n').slice(0, 1900) }),
      });
    } catch { /* Discord caído o URL mala: no bloquear el server */ }
  }
  if (!queue.size && flusher) { clearInterval(flusher); flusher = null; }
}

async function sendEmbed(url: string, title: string, description: string, color: number): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [{ title, description, color }] }),
    });
  } catch { /* ignorar */ }
}

function cfgOf(meta: ServerMeta | undefined): DiscordConfig | null {
  const d = meta?.discord;
  return d?.url ? d : null;
}

export async function discordEvent(
  serverId: string,
  kind: 'online' | 'offline' | 'crash' | 'join' | 'leave' | 'backup' | 'chat',
  detail: string,
): Promise<void> {
  const meta = await getServer(serverId);
  const cfg = cfgOf(meta);
  if (!cfg) return;
  const name = meta!.name;
  switch (kind) {
    case 'online':
      if (cfg.onStatus) await sendEmbed(cfg.url, `🟢 ${name} en línea`, detail, COLORS.ok);
      break;
    case 'offline':
      if (cfg.onStatus) await sendEmbed(cfg.url, `⚫ ${name} detenido`, detail, COLORS.info);
      break;
    case 'crash':
      if (cfg.onStatus) await sendEmbed(cfg.url, `💥 ${name} se ha caído`, detail, COLORS.err);
      break;
    case 'join':
      if (cfg.onPlayers) await sendEmbed(cfg.url, '', `➡️ **${detail}** entró a ${name}`, COLORS.ok);
      break;
    case 'leave':
      if (cfg.onPlayers) await sendEmbed(cfg.url, '', `⬅️ **${detail}** salió de ${name}`, COLORS.warn);
      break;
    case 'backup':
      if (cfg.onBackup) await sendEmbed(cfg.url, `💾 Backup de ${name}`, detail, COLORS.info);
      break;
    case 'chat':
      if (cfg.chatMirror) enqueue(cfg.url, detail);
      break;
  }
}

export async function testWebhook(url: string): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [{ title: '⚙ CraftDeck', description: 'Webhook conectado correctamente.', color: COLORS.ok }] }),
  });
  if (!res.ok) throw new Error(`Discord respondió HTTP ${res.status} — ¿la URL del webhook es correcta?`);
}
