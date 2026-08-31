# ───────────────────────────────────────────────
# Stage 1: Frontend dependency install
# ───────────────────────────────────────────────
FROM oven/bun:1.3.14-alpine AS frontend-deps
RUN apk update && apk add --no-cache libc6-compat && rm -rf /var/cache/apk/*
WORKDIR /app

COPY apps/web/package.json apps/web/bun.lock* ./
RUN bun install --frozen-lockfile

# ───────────────────────────────────────────────
# Stage 2: Frontend build
# ───────────────────────────────────────────────
FROM oven/bun:1.3.14-alpine AS frontend-builder
WORKDIR /app
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY apps/web .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Remove .env files to avoid leaking secrets into the build
RUN rm -f .env*

RUN bun run build

# ───────────────────────────────────────────────
# Stage 3: Frontend production image
# ───────────────────────────────────────────────
FROM node:24-alpine AS frontend-runner
WORKDIR /app

RUN apk update && apk add --no-cache curl && rm -rf /var/cache/apk/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=frontend-builder /app/public ./public

RUN mkdir .next && chown nextjs:nodejs .next

# Leverage output traces to reduce image size
COPY --from=frontend-builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=frontend-builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy server wrapper for runtime environment variable injection
COPY --chown=nextjs:nodejs apps/web/server-wrapper.js ./
RUN chmod +x server-wrapper.js

# ───────────────────────────────────────────────
# Stage 4: Collab server build
# ───────────────────────────────────────────────
FROM oven/bun:1.3.14-alpine AS collab-builder
WORKDIR /app

COPY apps/collab/package.json apps/collab/bun.lock* ./
RUN bun install --frozen-lockfile

COPY apps/collab/tsconfig.json ./
COPY apps/collab/src/ ./src/

RUN bun run build

# ───────────────────────────────────────────────
# Stage 5: Final image combining frontend + backend + collab
# ───────────────────────────────────────────────
FROM python:3.14.6-slim-bookworm AS runner

# Single apt layer: nginx, curl, netcat, ffmpeg, envsubst, node, pm2
# ffmpeg: video faststart remuxing on upload (services/utils/upload_content.py)
#   and the HLS transcode consumer (services/utils/hls_transcode.py). Both
#   degrade to no-ops without it, so long videos never become seekable.
# gettext-base: provides envsubst, used by docker/start.sh to bind nginx to $PORT.
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx curl netcat-openbsd ca-certificates gnupg unzip build-essential ffmpeg gettext-base \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g pm2 \
    && curl -fsSL https://bun.sh/install | bash \
    && apt-get purge -y gnupg \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /root/.npm \
    && rm /etc/nginx/sites-enabled/default

ENV PATH="/root/.bun/bin:${PATH}"

# Copy the frontend standalone build
COPY --from=frontend-runner /app /app/web

# Backend: install deps first (better layer caching)
WORKDIR /app/api
COPY ./apps/api/uv.lock ./apps/api/pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip uv \
    && uv sync --no-dev
COPY ./apps/api ./

# Remove Enterprise Edition folder for public builds
ARG LEARNHOUSE_PUBLIC=false
RUN if [ "$LEARNHOUSE_PUBLIC" = "true" ]; then rm -rf /app/api/ee; fi

# Collab server: copy built JS + production deps
WORKDIR /app/collab
COPY --from=collab-builder /app/dist ./dist
COPY apps/collab/package.json apps/collab/bun.lock* ./
RUN bun install --production

# Copy configs and scripts
WORKDIR /app
# Staged as a template, not as an active config: it carries an unexpanded
# ${PORT}, which start.sh renders into /etc/nginx/conf.d/default.conf before
# nginx is launched. Copying it straight to conf.d would leave an invalid
# config on disk for any path that starts nginx without start.sh.
COPY ./docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY ./apps/api/docker-entrypoint.sh /app/api/docker-entrypoint.sh
COPY ./docker/start.sh /app/start.sh
RUN chmod +x /app/api/docker-entrypoint.sh /app/start.sh

# PYTHONDONTWRITEBYTECODE: the image ships read-only source and gains nothing
# from writing .pyc files back into it. It also keeps __pycache__ out of the
# enterprise tree, where stale bytecode could otherwise shadow a source file
# that verifies clean against the signed manifest.
# PORT is the container's PUBLIC port — the one nginx binds and a PaaS routes
# to. Each internal service keeps its own variable: WEB_PORT (Next.js),
# LEARNHOUSE_PORT (FastAPI), COLLAB_PORT (Collab). Previously PORT doubled as
# Next.js's port, so a platform injecting PORT moved Next.js onto the public
# port and collided with nginx.
ENV PORT=80 WEB_PORT=8000 LEARNHOUSE_PORT=9000 COLLAB_PORT=4000 HOSTNAME=0.0.0.0 LEARNHOUSE_OSS=true NEXT_PUBLIC_LEARNHOUSE_OSS=true PYTHONDONTWRITEBYTECODE=1

EXPOSE 80 9000 4000

CMD ["sh", "/app/start.sh"]
