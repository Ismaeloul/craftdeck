import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');
export const DATA_DIR = process.env.CRAFTDECK_DATA ?? path.resolve(__dirname, '../data');

const PORT = Number(process.env.PORT ?? 8449);

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'craftdeck', version: '0.1.0' });
});

app.use(express.static(FRONTEND_DIR));

const httpServer = createServer(app);

// Canal de eventos en vivo (consola, estado, métricas). Se puebla en fases siguientes.
export const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

httpServer.listen(PORT, () => {
  console.log(`[craftdeck] panel en http://localhost:${PORT}`);
});
