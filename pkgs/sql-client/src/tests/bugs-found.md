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
