# Sim mem-engine wishlist (postgres-mem + sqlite-mem)

Owner backlog for engine-level changes that would unlock further speed when
`SIM_SQL_BACKEND=mem` (postgres-mem server + sqlite-mem clients). **Default
sim fabric is now `real` (PGlite + real SQLite)** — see
[`sim/test/src/setup/TESTING.md`](../sim/test/src/setup/TESTING.md). Mem remains
as an A/B / regression gate.

## Both engines

- First-class `clone()` / copy-on-write fork (avoid full `snapshot()` +
  `restore()` serialize for per-test isolation).
- `openFromSnapshot(bytes)` / `Database.fromSnapshot` without a JSON envelope
  round-trip in the SqlClient layer.
- Guaranteed byte-stable, fast restore under concurrent Jest workers.
- Benchmarks: migrate-seed open vs clone vs cold migrate (publish numbers in
  each package README).

## postgres-mem (`@crvouga/postgres-mem`)

- Cheap `clone()` after migrate (COW pages or structural share).
- Faster bulk DDL apply path for migration dumps (or `applySchemaDump` API).
- Optional JS `registerFunction` (stable) so JSON1 shims do not pay
  `CREATE FUNCTION` at every fresh DB before a seed pattern exists (DDL is
  already shared via `@pkgs/postgres-sqlite-compat` `json-functions-sql.ts`).
- Native int8-as-number/string mode for JSON-safe rows (avoid adapter coerce).
- Expand/skip unsupported `DO $$` / `ALTER … SET (` storage ops without
  caller intercepts.
- Snapshot that omits rebuildable catalog caches if restore is the hot path.

## sqlite-mem (`@crvouga/sqlite-mem`)

- Same `clone()` / COW API shape as postgres-mem (symmetric SqlClient boot
  helpers).
- Faster SQLM restore for client DBs if we later seed client templates too.
- Keep differential contract gates; wishlist is API/perf, not dialect parity.
- **Correctness:** secondary-index equality can miss rows after
  `INSERT … ON CONFLICT DO UPDATE`. Repro:
  [`docs/sqlite-mem-indexed-equality-after-upsert.md`](./sqlite-mem-indexed-equality-after-upsert.md).
  Product inbox no longer uses the `substr` workaround (default sim clients are
  real SQLite); mem fabric may still flake on inbox until fixed upstream.

## Already done in-repo (not engine work)

- Jest `globalSetup` + migrate-once seed (`sim-backend-seed.pglite.bin` for
  `real`, `sim-backend-seed.pgmm.json` for `mem`); `openSim` imports seed bytes
  and skips migrate.
- Process-scoped seed byte cache after first disk read.
- Reports on by default (`SIM_REPORT=0` to skip HTML frame I/O).
- Sim `ClientEnv.mutationSuccessHoldMs: 0` (wall: 900).
- Single composition-root fabric (`getSimSqlFabric`) selecting mem vs real.
