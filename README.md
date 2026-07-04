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

1. **Publicar imagen**: cada tag `vX.Y.Z` dispara GitHub Actions, que construye la imagen multi-arch (amd64 + arm64) y la publica en `ghcr.io/ismaeloul/craftdeck`:
   ```bash
   git tag v0.1.0 && git push origin master --tags
   ```
   La primera vez, en GitHub → tu perfil → Packages → `craftdeck` → Package settings → **Change visibility → Public**.
2. **App store**: la carpeta `umbrel-store/ismaeloul-craftdeck/` vive copiada en [`Ismaeloul/umbrel-app-store`](https://github.com/Ismaeloul/umbrel-app-store). Al cambiar de versión: actualizar `version` en `umbrel-app.yml` y el tag de la imagen en su `docker-compose.yml`.
3. **En el Umbrel**: si el store ya está añadido, la app aparece/actualiza sola al refrescar; si no, App Store → ⋯ → *Community App Stores* → `https://github.com/Ismaeloul/umbrel-app-store`.
4. Los amigos se conectan a `IP-del-umbrel:25565` (o el puerto del servidor creado). Para jugar desde fuera de casa, abre el puerto en el router o usa **playit.gg**/**Tailscale**.

## Estructura

- `backend/` — API Express + WebSocket en TypeScript. Gestiona procesos Java, catálogos de versiones (Mojang/Fabric/Forge/NeoForge), JREs de Adoptium, backups con retención.
- `frontend/` — panel (HTML/CSS/JS vanilla, sin build).
- `umbrel-store/` — community app store para instalarlo en umbrelOS.

## Estado (v0.1)

Funciona: crear/arrancar/parar servidores, consola, comandos, jugadores, mundo, archivos, backups, auditoría.
Pendiente (aún demo en la UI): instalación de mods desde Modrinth, mapa en vivo, estadísticas, programador de eventos, análisis de crashes, integraciones Discord/playit.gg.
