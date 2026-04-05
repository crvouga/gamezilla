# syntax=docker/dockerfile:1
FROM oven/bun:1 AS pruner
WORKDIR /app
COPY . .
RUN bunx turbo@2.8.21 prune @gamezilla/app --docker

FROM oven/bun:1 AS base
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile --production
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.json ./tsconfig.json

# Bun bug: "./*" wildcard exports don't resolve from workspace sub-packages.
# Expand them into explicit per-file entries at build time.
RUN bun packages/app/scripts/resolve-workspace.ts

ENV PORT=8080
EXPOSE 8080
CMD ["bun", "run", "packages/app/src/req-res.ts"]
