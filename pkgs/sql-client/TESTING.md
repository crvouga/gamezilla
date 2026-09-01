# Testing `@pkgs/sql-client`

## Layers

| Layer | Path | Command |
| --- | --- | --- |
| Unit | `src/**/*.test.ts` (excl. contract/e2e) | `bun test` |
| Portable matrix | `src/tests/matrix/portable-matrix.test.ts` | `bun test` |
| Algebraic PBT | `src/tests/pbt/*.pbt.test.ts` | `bun test` / `bun run test:pbt` |
| SQLite contract | `src/sqlite/sqlite-matrix.test.ts` | `bun test` |
| Live Postgres | `src/postgres/postgres.contract.test.ts` | `bun run test:contract` (needs `DATABASE_URL`) |
| Web system PBT | `src/sim/sql-client-web.system.pbt.test.ts` | `bun test` |
| E2E | `e2e/` | `bun run test:e2e` |

## Portable PBT matrix

Default backends (always on in bun):

- `sqlite-mem`, `bun-sqlite`
- `postgres-mem`, shared process-wide **PGlite**

Invariants:

1. **Wire-safety** — no `bigint` in query rows / `RunResult`; `JSON.stringify` succeeds; numbers work with `Math.max` (Hermes stand-in).
2. **Intra-dialect agreement** — SQLite engines agree; Postgres engines agree (canonical dump).
3. **Cross-dialect agreement** — sqlite-mem ↔ postgres-mem after type-map + dump codec.

Generators live under `src/tests/generators/`. Oracles under `src/tests/oracles/`.

### Replay a seed

```bash
FC_SEED=424242 bun test pkgs/sql-client/src/tests/pbt/wire-safety.pbt.test.ts
bun run test:pbt:random
```

### Backend notes

| Backend | Notes |
| --- | --- |
| PGlite | One process-wide instance (`shared-pglite.ts`); samples use unique table names + `DROP TABLE … CASCADE` |
| postgres-mem | Fresh instance per sample; in-memory Postgres for unit / PBT |
| Expo / better-sqlite3 / WASM | Optional; skipped when the engine cannot load |
| Live `pg` / Bun postgres | Int8 pin in `postgres.contract.test.ts` when `DATABASE_URL` is set |

## Findings

See [`src/tests/bugs-found.md`](src/tests/bugs-found.md).
