# CraftDeck

Panel de control de servidores de Minecraft para umbrelOS (y cualquier máquina con Docker o Node).

Crea servidores **Vanilla, Fabric, Forge o NeoForge** eligiendo versión de una lista — CraftDeck descarga el Java correcto (Temurin) y el jar del servidor por ti. Consola en vivo, jugadores (OP/kick/ban/whitelist), edición visual de `server.properties`, editor de configs y backups manuales + automáticos.

## Desarrollo (Windows/Mac/Linux)

```bash
cd backend
npm install
npm run dev        # panel en http://localhost:8449
```

No hace falta tener Java: se descarga solo en `backend/data/runtimes/`.

## Docker (local)

```bash
docker compose up --build
```

## Desplegar en el Umbrel

La app vive en [`Ismaeloul/umbrel-app-store`](https://github.com/Ismaeloul/umbrel-app-store) → carpeta `ismaeloul-craftdeck/`, con el código embebido (patrón del store: imagen estándar `node:22-bookworm-slim` que hace `npm install` al primer arranque; Umbrel copia la carpeta a `APP_DATA_DIR` al instalar). No hay imagen Docker propia que publicar.

**Para actualizar la app**: copiar `backend/src`, `backend/package*.json`, `backend/tsconfig.json` y `frontend/` de este repo a la carpeta `ismaeloul-craftdeck/` del store, subir el `version` de `umbrel-app.yml` y hacer push. En el Umbrel aparecerá la actualización al refrescar el App Store.

Los amigos se conectan a `IP-del-umbrel:25565` (o el puerto del servidor creado). Para jugar desde fuera de casa, abre el puerto en el router o usa **playit.gg**/**Tailscale**.

> Nota: existe también un `Dockerfile` + workflow de GHCR por si algún día prefieres imagen propia multi-arch, pero el store no lo usa.

## Estructura

- `backend/` — API Express + WebSocket en TypeScript. Gestiona procesos Java, catálogos de versiones (Mojang/Fabric/Forge/NeoForge), JREs de Adoptium, backups con retención.
- `frontend/` — panel (HTML/CSS/JS vanilla, sin build).
- `umbrel-store/` — community app store para instalarlo en umbrelOS.

## Estado (v0.1)

Funciona: crear/arrancar/parar servidores, consola, comandos, jugadores, mundo, archivos, backups, auditoría.
Pendiente (aún demo en la UI): instalación de mods desde Modrinth, mapa en vivo, estadísticas, programador de eventos, análisis de crashes, integraciones Discord/playit.gg.
