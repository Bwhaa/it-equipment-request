# Build context = repository root: docker build -f apps/api/Dockerfile .
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
RUN corepack enable \
 && corepack prepare "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")" --activate
# Manifests of every workspace + the Prisma schema come first: apps/api has a postinstall (prisma generate).
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
RUN pnpm install --frozen-lockfile --filter "api..."
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter api build && pnpm --filter api build:seed
RUN test -f apps/api/dist/main.js && test -f apps/api/dist-prisma/seed-if-empty.js
RUN pnpm --filter api deploy --legacy --prod /prod/api \
 && cp -r apps/api/dist /prod/api/dist \
 && cp -r apps/api/dist-prisma /prod/api/dist-prisma \
 && cp -r apps/api/prisma /prod/api/prisma \
 && cp apps/api/docker-entrypoint.sh /prod/api/docker-entrypoint.sh

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /prod/api ./
USER node
# Generate the client and fetch the engines at build time: the container never downloads anything at start.
RUN node_modules/.bin/prisma generate && node_modules/.bin/prisma version
ENV NODE_ENV=production PRISMA_HIDE_UPDATE_MESSAGE=1
EXPOSE 3001
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
