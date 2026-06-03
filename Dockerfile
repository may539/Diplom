# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS deps

ENV NODE_ENV=production \
    npm_config_loglevel=warn

WORKDIR /app

# sqlite3 may need native build tooling when a prebuilt binary is unavailable.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      python3 \
      make \
      g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 app \
    && useradd --system --uid 1001 --gid app --home /app --shell /usr/sbin/nologin app

WORKDIR /app

COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --chown=app:app . .

RUN mkdir -p /app/data /app/logs /app/public/models \
    && chown -R app:app /app/data /app/logs /app/public/models

USER app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/specialties',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
