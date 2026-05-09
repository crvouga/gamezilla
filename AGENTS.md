# Agent Notes

## Hard Rules

- **Never patch dependencies.** Do not use `bun patch`, `patch-package`, `pnpm patch`, or any other dependency-patching mechanism. Do not add a `patches/` directory or a `patchedDependencies` / `pnpm.patchedDependencies` / `resolutions` field to `package.json`. If a third-party library has a bug, work around it in our own code or accept the behavior — never fork the dep in-tree. CI enforces this via `bun run check:no-patches`.

## CI / Turbo Remote Cache

GitHub Actions runs checks with `DOPPLER_CONFIG=local`. For Turbo Remote Cache hits in CI, ensure the Doppler **`local`** config defines `TURBO_API`, `TURBO_TOKEN`, `TURBO_TEAM`, and `TURBO_CACHE` (e.g. `remote:rw`). See `apps/infra/src/cli/secrets/turbo-token.ts` for hints.

## Local database

Local dev uses **PGlite in socket mode** (TCP Postgres wire on `127.0.0.1:5432` by default) — no Docker. **Detached** start (returns immediately): `bun run --filter @gamezilla/api db:up` or `bun run --filter @gamezilla/db dev`. **Foreground** (logs): `bun run --filter @gamezilla/db up`. Set Doppler **`local`** `DB_URL` to `postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable` (PGlite does not support SSL on the socket server). See [PGlite Socket](https://pglite.dev/docs/pglite-socket). Migrations: `DOPPLER_CONFIG=local doppler run -- bun run --filter @gamezilla/api db:migrate`. Stop: `bun run --filter @gamezilla/db kill` (frees the listen port). Persistent data lives in `apps/db/.pglite/` unless `PGLITE_DATA_DIR` is set (`memory://` for ephemeral).
