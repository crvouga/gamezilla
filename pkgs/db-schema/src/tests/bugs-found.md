# Bugs found during db-schema correctness overhaul

## BUG-1: SQLite indexes lost after rebuild (fixed)

- **Pin:** `roundtrip.pbt.test.ts` rebuild preserves indexes
- **Symptom:** `planIndexOps` skipped `create_index` when pre-rebuild catalog
  still listed the fingerprint; `DROP TABLE` during rebuild deleted indexes
  permanently.
- **Fix:** Track tables that undergo `rebuild_table` / `drop_table` and force
  index recreation.

## BUG-2: Backfill skipped when combined with rebuild (fixed)

- **Pin:** lifecycle integration + `renamedFrom` contract tests
- **Symptom:** `planOneTable` returned only `rebuild_table`, omitting
  `backfill` for new columns with explicit `backfill: { sql }`.
- **Fix:** `backfills` on rebuild op + post-rebuild `backfill` operations;
  rebuild INSERT applies copy aliases first.

## BUG-3: `drop_column` emit dropped all rows (fixed)

- **Pin:** removed `drop_column` from `ClientOperation` union
- **Symptom:** `emit.ts` rebuilt with `copyColumns: []`, wiping table data.
- **Fix:** Deleted the operation kind entirely (planner never emitted it).

## BUG-4: SQLite in-place type change caused silent coercion (fixed)

- **Pin:** `emit-safety.pbt.test.ts` forbidden type change
- **Symptom:** `needsRebuild` rewrote tables on physical type mismatch,
  allowing data loss via SQLite coercion.
- **Fix:** Type/nullability mismatch is `forbidden` on both dialects; rebuild
  only for deprecated extras, lifecycle copy, and missing CHECK/FK shape.

## BUG-5: `_meta` extras failed ident validation (fixed)

- **Pin:** `plan.test.ts` + `sqlite/reconcile.integration.test.ts` `_meta` cases
- **Symptom:** `asSchemaIdent('_meta')` rejected leading-underscore extras.
- **Fix:** `PhysicalIdent` for `_`-prefixed catalog columns; `SchemaIdent` for
  declared snake_case names.
