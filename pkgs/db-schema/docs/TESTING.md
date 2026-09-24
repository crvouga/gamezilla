# Testing `@pkgs/db-schema`

## Layers

| Layer | Path | Command |
| --- | --- | --- |
| Pure units (planner / evolution / snapshot) | `pkgs/db-schema/tests/*.test.ts` | `bun test pkgs/db-schema/tests` |
| Dialect contract matrix | `pkgs/db-schema-postgres/tests/contract.test.ts`, `pkgs/db-schema-sqlite/tests/contract.test.ts` (shared suite in `pkgs/db-schema/src/test/contract-suite.ts`) | `bun test pkgs/db-schema-postgres/tests pkgs/db-schema-sqlite/tests` |
| Postgres behavior pins | `pkgs/db-schema-postgres/tests/*.test.ts` | `bun test pkgs/db-schema-postgres/tests` |
| SQLite behavior pins | `pkgs/db-schema-sqlite/tests/*.test.ts` | `bun test pkgs/db-schema-sqlite/tests` |
| Weeks-behind client worlds | `pkgs/sync-engine/tests/schema-drift.test.ts` | `bun test pkgs/sync-engine/tests/schema-drift.test.ts` |
| Evolution gate (CI) | `libs/runtime/scripts/check-schema-evolution.ts` | `bun run --filter @libs/runtime check:schema-evolution` |
| Append-only names (CI) | `apps/server/tests/contract-manifest.test.ts` | `bun run --filter @apps/server test` |

## Invariants (oracles)

1. **No destructive Postgres DDL** — emitted SQL never matches `FORBIDDEN_SERVER_DDL`.
2. **Server fail-closed** — an extra column without a tombstone, a tombstone with the wrong frozen type, and a missing tombstone target are all drift with zero DDL.
3. **Client tolerance** — an undeclared local column is preserved with its data and never raises; a tombstoned column is dropped only by a row-preserving rebuild.
4. **No in-place type change** — type/nullability mismatch is forbidden on both dialects.
5. **Row preservation** — rebuilds keep `id` and every live column value, and recover from an interrupted rebuild via the `_old_<table>` staging table.
6. **FK integrity across rebuild** — `ALTER TABLE … RENAME` never repoints another table's foreign key at a staging name.
7. **Idempotence** — apply(S) twice emits no DDL; apply → introspect → re-plan is empty.
8. **snake_case** — all schema identifiers validated at authoring time (runtime + type-level).
9. **Evolution gate** — removing/renaming/retyping without a tombstone, weakening a tombstone, or dropping a tombstone fails `assertEvolvable`.
10. **Append-only contract names** — removing or renaming a registered query/mutation name fails `apps/server/tests/contract-manifest.test.ts`.

## Backends

| Backend | Usage |
| --- | --- |
| `mockingbird-sqlite` | dialect contract matrix + pure planner pins |
| `bun:sqlite` (`SqlClientImplBunSqlite`) | SQLite behavior pins incl. rebuild recovery |
| `mockingbird-postgres` | dialect contract matrix + Postgres behavior pins |
| live `pg` | Postgres integration pin when `DATABASE_URL` is set |

Postgres catalog FK/enum introspection does not exist — the portable-object
layer is intentionally out of scope. Catalog invalid-index detection falls back
to `[]` on engines without `pg_index` (mockingbird-postgres).

## Regenerating the contract snapshot

```bash
bun run --filter @libs/runtime schema:snapshot     # writes release N+1
bun run --filter @libs/runtime check:schema-evolution
```

`schema:snapshot` refuses to write an illegal evolution, so regeneration cannot
launder a change that would break a weeks-behind client.
