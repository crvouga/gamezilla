# Bugs found during sql-client PBT matrix

## BUG-1: Hermes `Number(bigint)` / Postgres int8 rows (fixed)

- **Property / pin:** `bug-bigint-int8.pbt` / `wire-safety.pbt` / portable contract
- **Symptom:** Expo Go playground hydrate logged `Cannot convert BigInt to number`
  when postgres-mem / PGlite returned `bigint` for domain `integer` (physical
  `bigint`) columns. Hermes rejects `Number(bigint)` / `JSON.stringify(bigint)`.
- **Fix:** `normalizePgInt8Value` converts via decimal text (Hermes-safe);
  applied on PGlite, postgres-mem, and shared `pgQueryRows` (node-pg).
- **Pin:** `src/tests/pbt/bug-bigint-int8.pbt.test.ts`,
  `src/tests/contract/portable-contract.ts`, live int8 case in
  `src/postgres/postgres.contract.test.ts`.

## BUG-2: In-engine int8 `n + 1` mixes BigInt and number (engine)

- **Property / pin:** `bug-bigint-mix.pbt` / sync-engine
  `allocate-topic-push-seq`
- **Symptom:** Playground `/api/query` 500 with V8
  `Cannot mix BigInt and other types, use explicit conversions` (Bun:
  `Invalid mix of BigInt and other type in addition`) during
  `ON CONFLICT … SET n = n + 1` on physical `bigint` columns
  (`allocateTopicPushSeq` / client-config notify).
- **Cause:** postgres-mem `toI8` returns a raw JS `number` when the value is
  already typed int8; `addI` then does `number + bigint`. Wire normalize cannot
  help — throw is inside the engine.
- **Upstream:** `docs/sim-mem-engine-wishlist.md` (copy-paste repro). Engine fix:
  always `BigInt(v)` for int8 slots.
- **Product pin / workaround:** `n + CAST(1 AS BIGINT)` in allocate SQL
  (portable; `::bigint` is Postgres-only); pins assert two-shot upsert does
  not throw on ALWAYS_FACTORIES.
- **Pin:** `src/tests/pbt/bug-bigint-mix.pbt.test.ts`,
  `@pkgs/sync-engine` `allocate-topic-push-seq.unit.test.ts`.
