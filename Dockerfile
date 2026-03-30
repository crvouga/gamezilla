FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/app/package.json ./packages/app/
COPY packages/shared/package.json ./packages/shared/
COPY packages/patch-db/package.json ./packages/patch-db/
RUN bun install --frozen-lockfile --production
COPY packages/shared ./packages/shared
COPY packages/patch-db ./packages/patch-db
COPY packages/app ./packages/app
COPY tsconfig.json ./
ENV PORT=8080
EXPOSE 8080
CMD ["bun", "run", "packages/app/src/sync-server.ts"]
