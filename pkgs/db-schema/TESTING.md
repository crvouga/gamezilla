# Testing `@pkgs/db-schema`

## Layers

| Layer | Path | Command |
| --- | --- | --- |
| Unit | `src/**/*.test.ts` (excl. PBT/system) | `bun test` |
| Compatibility PBT | `src/core/*.pbt.test.ts` | `bun test` |
| Convention PBT | `src/tests/pbt/conventions.pbt.test.ts` | `bun test` |
| Planner / emit PBT | `src/tests/pbt/planner.pbt.test.ts`, `emit-safety.pbt.test.ts` | `bun test` |
| Live round-trip | `src/tests/pbt/roundtrip.pbt.test.ts` | `bun test` |
| Contract matrix | `src/interface.contract.test.ts` | `bun test` |
| Integration | `@pkgs/db-schema-postgres` / `@pkgs/db-schema-sqlite` `tests/*-reconcile.integration.test.ts` | `bun test` |
| System world | `src/tests/scenario/*.pbt.test.ts` | `bun test` |

## Invariants (oracles)

1. **No destructive Postgres DDL** — emitted SQL never matches `FORBIDDEN_SERVER_DDL`.
2. **Fail-closed** — extra columns without deprecation tombstones → drift, zero DDL.
3. **No in-place type change** — type/nullability mismatch is forbidden on both dialects.
4. **Row preservation** — legal rebuilds keep `id` + live column values; `_meta` extras survive.
5. **Index survival** — package indexes exist after SQLite rebuild.
6. **Idempotence** — apply(S) twice emits no DDL; apply → introspect → re-plan is empty.
7. **snake_case** — all schema idents validated at authoring time (runtime + type-level).

Generators live under `src/tests/generators/`. Findings: [`src/tests/bugs-found.md`](src/tests/bugs-found.md).

## Replay a seed

```bash
FC_SEED=424242 bun test pkgs/db-schema/src/tests/pbt/conventions.pbt.test.ts
```

## Backends

| Backend | Usage |
| --- | --- |
| mockingbird-sqlite | Default PBT + contract matrix |
| mockingbird-postgres | Default PBT + contract matrix |
| bun:sqlite | SQLite integration pin |
| Live `pg` | Postgres integration pin when `DATABASE_URL` is set |

Postgres catalog FK introspection falls back to `[]` on engines that lack
`pg_constraint` array columns (mockingbird-postgres). Real Postgres uses full catalog.
