# `@pkgs/postgres-embedded`

Process runner for local embedded Postgres. Tests and CI call
`startEmbeddedPostgres`; product migrate/seed live in
`libs/runtime/scripts/migrate-cli.ts` and `apps/server/scripts/`.
Contract suites pass `freePostgresPort()` so parallel suites and other
worktrees never share a cluster.
