# Testing the SQL clients

`@pkgs/sql-client-contract` is the shared suite every `SqlClient` backend
passes. Repo-wide testing policy: [`docs/TESTING.md`](../../../docs/TESTING.md).

## Layers

| Layer | Path | Kind |
| --- | --- | --- |
| Interface contract | `tests/interface.test.ts`, `tests/txn.test.ts`, `tests/sqlite-contract/` | model: every backend behaves the same |
| Round-trip | `tests/roundtrip.test.ts` | property: generated schema + row survives insert → select |
| Cross-dialect agreement | `tests/agreement-portable.test.ts` | property: mockingbird-sqlite ↔ mockingbird-postgres agree after type-map + dump codec |
| Compat corpus | `tests/postgres-sqlite-compat-corpus.test.ts` | example corpus of the Postgres ↔ SQLite dialect bridge |
| Regressions | `tests/bug-*.test.ts` | example: one pinned input per bug ([`known-bugs.json`](../../../libs/tools/goal/known-bugs.json)) |
| Live Postgres | `@pkgs/sql-client-postgres` `test:contract` | the same contract against embedded Postgres |

Invariants the properties check:

1. **Wire-safety** — no `bigint` in query rows / `RunResult`; `JSON.stringify`
   succeeds.
2. **Intra-dialect agreement** — SQLite engines agree; Postgres engines agree
   (canonical dump).
3. **Cross-dialect agreement** — mockingbird-sqlite ↔ mockingbird-postgres after type-map +
   dump codec.

Generators live under `tests/helpers/generators/`, oracles under
`tests/helpers/oracles/`.

## Replay a seed

```bash
FC_SEED=424242 bun test pkgs/sql-client-contract/tests/roundtrip.test.ts
bun run test:pbt:random
```
