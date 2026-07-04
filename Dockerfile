# ---- build: compila el backend TypeScript ----
FROM node:22-slim AS build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npx tsc

# ---- runtime ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8449 \
    CRAFTDECK_DATA=/data \
    CRAFTDECK_FRONTEND=/app/frontend
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY frontend ./frontend
VOLUME /data
EXPOSE 8449 25565-25574
CMD ["node", "dist/index.js"]
