FROM node:22-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/sdk/package.json packages/sdk/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod
COPY packages/sdk packages/sdk
COPY apps/api apps/api
ENV NODE_ENV=production
EXPOSE 8787
CMD ["pnpm", "--filter", "@zenoindex/api", "start"]
