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

La app vive en [`Ismaeloul/umbrel-app-store`](https://github.com/Ismaeloul/umbrel-app-store) → carpeta `ismaeloul-craftdeck/`. El `docker-compose.yml` del store es autosuficiente: una imagen estándar `node:22-bookworm-slim` con un bootstrap que descarga el tarball del tag `vX.Y.Z` de este repo y arranca el backend. umbrelOS solo re-copia `docker-compose.yml` y `umbrel-app.yml` al actualizar, por eso la versión viaja en el compose.

**Flujo de release**:
1. Subir `APP_VERSION` en `backend/src/paths.ts` (y `version` de `backend/package.json`), commit.
2. `git tag vX.Y.Z && git push && git push --tags` en este repo.
3. En el store: subir `CRAFTDECK_VERSION` del compose y `version`/`releaseNotes` de `umbrel-app.yml`, push.
4. En el Umbrel aparecerá la actualización al refrescar el App Store.

Los amigos se conectan a `IP-del-umbrel:25565` (o el puerto del servidor creado). Para jugar desde fuera de casa, abre el puerto en el router o usa **playit.gg**/**Tailscale**.

> Nota: existe también un `Dockerfile` + workflow de GHCR por si algún día prefieres imagen propia multi-arch, pero el store no lo usa.

## Estructura

- `backend/` — API Express + WebSocket en TypeScript. Gestiona procesos Java, catálogos de versiones (Mojang/Fabric/Forge/NeoForge), JREs de Adoptium, backups con retención, eventos programados, Discord y playit.gg.
- `frontend/` — panel (HTML/CSS/JS vanilla, sin build).

## Estado (v0.4)

Funciona: crear/arrancar/parar servidores, watchdog anti-crash con auto-reinicio y análisis del culpable, consola, comandos, jugadores (OP/kick/ban/whitelist, modo no premium), mods desde Modrinth (explorar/instalar/actualizar/desactivar), mundo, archivos, backups (manuales + diarios con retención), eventos programados, diagnóstico de crashes, integraciones Discord y playit.gg, auditoría.
Pendiente: mapa en vivo (BlueMap), auto-arranque del túnel playit.
