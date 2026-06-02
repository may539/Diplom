# syntax=docker/dockerfile:1.6

# ---------- build stage ----------
FROM node:20-bookworm-slim AS build

ENV NODE_ENV=production \
    npm_config_loglevel=warn

WORKDIR /app

# Build deps for native modules (sqlite3). Removed in the final image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        python3 \
        make \
        g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

# ---------- runtime stage ----------
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0

# tini = small init that reaps zombies and forwards signals
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 app \
    && useradd --system --uid 1001 --gid app --home /app --shell /usr/sbin/nologin app

WORKDIR /app

COPY --from=build --chown=app:app /app /app

# Persistent data directories — mount these as volumes in production.
RUN mkdir -p /app/data /app/models/uploads /app/logs \
    && chown -R app:app /app/data /app/models /app/logs

USER app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/specialties',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
