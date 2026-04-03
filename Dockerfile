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
# Root tsconfig is not part of the pruned tree; Bun uses its `paths` for module resolution.
# NOTE: packages/app/tsconfig.json must NOT define its own `paths` — Bun ignores child paths
# when `extends` is used, so paths must live only in the root config.
COPY --from=pruner /app/tsconfig.json ./tsconfig.json

# Smoke-test: verify every workspace import used by req-res and worker resolves inside the
# image. Catches tsconfig path / package.json exports breakage at build time instead of
# letting ECS cycle through restarts until the circuit breaker trips.
RUN bun -e "\
  const entrypoints = ['packages/app/src/req-res.ts', 'packages/app/src/worker.ts']; \
  for (const ep of entrypoints) { \
    const file = Bun.file(ep); \
    if (!(await file.exists())) throw new Error('Missing entrypoint: ' + ep); \
    const src = await file.text(); \
    const re = /from\s+['\"](@gamezilla\/[^'\"]+)['\"]/g; \
    let m; \
    while ((m = re.exec(src)) !== null) { \
      const spec = m[1]; \
      try { require.resolve(spec); } \
      catch { \
        try { await import(spec); } \
        catch (e) { throw new Error('Cannot resolve ' + spec + ' from ' + ep + ': ' + e.message); } \
      } \
    } \
  } \
  console.log('Docker smoke-test: all @gamezilla/* imports resolve OK');"

ENV PORT=8080
EXPOSE 8080
CMD ["bun", "run", "packages/app/src/req-res.ts"]
