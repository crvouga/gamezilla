# syntax=docker/dockerfile:1
# Prune workspace via Turborepo so package boundaries + lockfile stay aligned (no manual COPY per package).
FROM oven/bun:1 AS pruner
WORKDIR /app
COPY . .
# Pin to bun.lock resolution (avoid bunx floating to a newer prune implementation).
RUN bunx turbo@2.8.21 prune @gamezilla/app --docker

FROM oven/bun:1 AS base
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile --production
COPY --from=pruner /app/out/full/ .
# Root tsconfig is not part of the pruned tree; keep path aliases for sync-server.
COPY --from=pruner /app/tsconfig.json ./tsconfig.json
ENV PORT=8080
EXPOSE 8080
CMD ["bun", "run", "packages/app/src/sync-server.ts"]
