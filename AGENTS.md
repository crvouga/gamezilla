# Agent Notes

## Hard Rules

- **Never patch dependencies.** Do not use `bun patch`, `patch-package`, `pnpm patch`, or any other dependency-patching mechanism. Do not add a `patches/` directory or a `patchedDependencies` / `pnpm.patchedDependencies` / `resolutions` field to `package.json`. If a third-party library has a bug, work around it in our own code or accept the behavior — never fork the dep in-tree. CI enforces this via `bun run check:no-patches`.

## CI / Turbo Remote Cache

GitHub Actions runs checks with `DOPPLER_CONFIG=local`. For Turbo Remote Cache hits in CI, ensure the Doppler **`local`** config defines `TURBO_API`, `TURBO_TOKEN`, `TURBO_TEAM`, and `TURBO_CACHE` (e.g. `remote:rw`). See `apps/infra/src/cli/secrets/turbo-token.ts` for hints.

## Local database

Local dev runs a **real PostgreSQL cluster** managed by `@gamezilla/pg` — no Docker, no PGlite. The wrapper spawns `postgres` directly (in our process group, so it can never be orphaned by the dev shell), waits on `pg_isready`, and translates `SIGINT`/`SIGTERM` from `turbo dev` into a `pg_ctl stop -m fast`. Required CLI tooling (`postgres`, `pg_ctl`, `initdb`, `pg_isready`) is enforced by `bun run infra setup` / `status` via the `PostgresDep` class.

The whole stack starts together via `bun run dev` at the repo root; to run just Postgres (foreground, logs visible): `bun run --filter @gamezilla/pg dev`. Stop it with `bun run --filter @gamezilla/pg kill` — this targets only our wrapper PID + cluster data dir; it will **not** terminate unrelated Postgres servers that happen to be on the same port.

Set Doppler **`local`** `DB_URL` to `postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable`. Migrations: `DOPPLER_CONFIG=local doppler run -- bun run --filter @gamezilla/api db:migrate`. Persistent data lives in `apps/pg/.postgres/data/`; the wrapper PID and a tee'd `postgres.log` live in `apps/pg/.postgres/run/`. Tunables (all optional): `PG_HOST`, `PG_PORT`, `PG_DATA_DIR`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`, `PG_BIN_DIR` (force a specific Postgres install).

Platform support:

- **macOS / Linux** — install Postgres (`brew install postgresql@17` on macOS; `apt-get install postgresql` on Debian/Ubuntu, etc.) and run `bun run dev` directly.
- **Windows** — run dev inside WSL2; native Windows is not supported by `@gamezilla/pg` (the lifecycle script still produces a clear error message + install hint if invoked there).
