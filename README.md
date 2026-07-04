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

## Desplegar en tu Umbrel

1. **Sube este repo a GitHub** (público), p. ej. `github.com/TUUSUARIO/craftdeck`.
2. **Publica la imagen**: crea un tag y súbelo — GitHub Actions construye la imagen multi-arch (amd64 + arm64) y la publica en GHCR:
   ```bash
   git tag v0.1.0 && git push origin main --tags
   ```
   La primera vez, ve a GitHub → Packages → `craftdeck` → Package settings y márcalo como **público**.
3. **Edita `umbrel-store/`**: sustituye `CAMBIAME` por tu usuario de GitHub en `umbrel-app.yml` y `docker-compose.yml`.
4. **Crea el repo del app store**: sube el contenido de `umbrel-store/` a un repo propio (p. ej. `TUUSUARIO/umbrel-apps`).
5. **En tu Umbrel**: App Store → ⋯ → *Community App Stores* → pega la URL del repo → Add → instala **CraftDeck**.
6. Los amigos se conectan a `IP-de-tu-umbrel:25565` (o el puerto del servidor que crees). Para jugar desde fuera de casa, abre el puerto en el router o usa la app de **playit.gg**/**Tailscale**.

## Estructura

- `backend/` — API Express + WebSocket en TypeScript. Gestiona procesos Java, catálogos de versiones (Mojang/Fabric/Forge/NeoForge), JREs de Adoptium, backups con retención.
- `frontend/` — panel (HTML/CSS/JS vanilla, sin build).
- `umbrel-store/` — community app store para instalarlo en umbrelOS.

## Estado (v0.1)

Funciona: crear/arrancar/parar servidores, consola, comandos, jugadores, mundo, archivos, backups, auditoría.
Pendiente (aún demo en la UI): instalación de mods desde Modrinth, mapa en vivo, estadísticas, programador de eventos, análisis de crashes, integraciones Discord/playit.gg.
