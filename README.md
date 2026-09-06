# CraftDeck

Panel de control de servidores de Minecraft para umbrelOS (y cualquier máquina con Docker o Node).

Crea servidores **Vanilla, Paper (plugins), Fabric, Forge o NeoForge** eligiendo versión de una lista, o desde un **modpack de Modrinth** — CraftDeck descarga el Java correcto (Temurin) y el jar del servidor por ti. Consola en vivo, jugadores (OP/kick/ban/whitelist, historial), mods y plugins de Modrinth, mapa en vivo con BlueMap, edición visual de `server.properties`, editor de configs y backups manuales + automáticos.

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

## Estado (v0.7)

Funciona: crear/arrancar/parar servidores (Vanilla, Paper, Fabric, Forge, NeoForge, o desde un modpack .mrpack de Modrinth), clonar servidores, cambio de versión de Minecraft conservando el mundo (con migración de mods), **modo dormido** (apagado por inactividad y despertar cuando alguien intenta entrar), watchdog anti-crash con auto-reinicio y análisis del culpable, consola (historial de comandos, filtro, buscador y acciones rápidas), jugadores (OP/kick/ban/whitelist también sin estar conectados, desbanear, modo no premium, caras, historial de conexiones), mods y plugins desde Modrinth (explorar/instalar/actualizar/desactivar/subir .jar, con icono), datapacks, pack de amigos en .zip y .mrpack con solo lo que el cliente necesita, mapa en vivo con BlueMap (proxy dentro del panel), pregeneración con Chunky, mundo (importar .zip, icono del servidor, MOTD con colores), archivos, backups (manuales, automáticos a la hora y días elegidos, retención, restaurar solo mundo o todo, subir .zip), eventos programados, diagnóstico de crashes (descarga de logs), TPS y gráficas de 24 h, almacenamiento, integraciones Discord y playit.gg (auto-arranque y túneles detectados), página «Todos los servidores», auditoría, panel responsive.
Los servidores que estaban encendidos vuelven solos tras reiniciar el Umbrel o actualizar la app.

Cómo se sirve el mapa: BlueMap escucha solo en 127.0.0.1 dentro del contenedor (puerto 8100 + índice del servidor) y el backend hace de proxy en `/api/servers/:id/map/view/`, así que no hace falta abrir más puertos en el compose.

Modo dormido: mientras un servidor está dormido, CraftDeck escucha en su puerto de juego (`wake.ts`) hablando lo mínimo del protocolo de Minecraft: responde al ping de la lista de servidores con «servidor dormido» y, al primer intento de login, desconecta con «despertando…», suelta el puerto y arranca Java.
