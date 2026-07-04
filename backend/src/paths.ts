import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');
export const DATA_DIR = process.env.CRAFTDECK_DATA ?? path.resolve(__dirname, '../data');
export const SERVERS_DIR = path.join(DATA_DIR, 'servers');
export const RUNTIMES_DIR = path.join(DATA_DIR, 'runtimes');
export const CACHE_DIR = path.join(DATA_DIR, 'cache');
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
