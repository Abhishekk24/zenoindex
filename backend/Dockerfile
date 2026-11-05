# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# zenoIndex-backend — Hono API (apps/api) + @zenoindex/sdk, pnpm workspace.
# Multi-stage: deps -> runner. No build step: tsx runs the TypeScript directly.
# All config is runtime env (--env-file); nothing secret is baked into the image.
# ---------------------------------------------------------------------------

ARG NODE_VERSION=22

# --- deps: production node_modules for the api and the workspace sdk ---------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
RUN corepack enable
# Manifests only, so this layer is cached until dependencies change.
# pnpm-workspace.yaml carries allowBuilds (esbuild, needed by tsx at runtime).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/sdk/package.json packages/sdk/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod --filter @zenoindex/api...

# --- runner: minimal runtime image ------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787

COPY --from=deps /app ./
COPY tsconfig.base.json ./
COPY packages/sdk ./packages/sdk
COPY apps/api ./apps/api

# The base image's unprivileged `node` user.
USER node
WORKDIR /app/apps/api
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD wget -qO- "http://127.0.0.1:${PORT}/health" > /dev/null || exit 1

# Migrations run on boot (src/index.ts), then the server listens on $PORT.
CMD ["node", "--import", "tsx", "src/index.ts"]
