# `@apps/postgres`

Local embedded Postgres for non-production (`SECRETS_ENV=dev`) via [`embedded-postgres`](https://www.npmjs.com/package/embedded-postgres). Turbo starts this package alongside `@apps/api` / `@apps/client` for `bun dev` and `bun preview`.

Production (`SECRETS_ENV=prd`) continues to use Infisical Neon — this app is never deployed.

## Local

| | |
| --- | --- |
| Port | `15432` |
| User / password | `postgres` / `postgres` |
| Database | `gamezilla` |
| Data dir | `apps/postgres/data/db` (gitignored) |

```text
postgresql://postgres:postgres@127.0.0.1:15432/gamezilla?sslmode=disable
```

On start: initialise cluster (once) → start → create DB → migrate (subprocess to `apps/api/src/db/migrate-cli.ts` with `--database-url=`) → local seed hook → stay alive.

`@apps/api` `setup` always writes this URL into `.dev.vars` for `SECRETS_ENV=dev`.

## Commands

```bash
bun run --filter @apps/postgres setup   # initdb if needed
bun run --filter @apps/postgres dev     # start + migrate + seed
bun run --filter @apps/postgres seed    # re-run local seed only
bun run db:wipe:dev                     # DROP SCHEMA + remigrate (local .dev.vars)
```

Hard reset: stop the stack, `rm -rf apps/postgres/data`, then `bun dev`.

Ctrl-C / `bun kill` tears down the process and reclaims port `15432`.
