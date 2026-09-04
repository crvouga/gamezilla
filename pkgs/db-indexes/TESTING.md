# Testing `@pkgs/db-indexes`

## Layers

| Layer | Path | Command |
| --- | --- | --- |
| Unit / contract | `tests/*.test.ts` | `bun test` |
| Generators | `tests/generators` | imported by PBT / scenario |
| Sim / scenario | `tests/scenario` | `bun test` / `bun run test:sim` |
| Mutants | `tests/mutants` | `bun run mutants` |

## Replay a seed

```bash
INDEXES_SIM_SEED=42 bun test tests/scenario/known-seeds.test.ts
```

Persist new failure seeds in `tests/scenario/known-seeds.txt` (always run first).
Corpus runs are driven by `@pkgs/sim` `explore` over `indexes` + `INDEXES_ACTIONS`.

## Invariant → assert / sim / property map

| Invariant | Prod assert | Sim check | Property |
| --- | --- | --- | --- |
| I1 owned-only DDL | `diffOwnedIndexes` + `reconcile` execute | `checkInvariantsAsync` + scenario props | `ownership` |
| I2 crash-converge | n/a (executor returns crashed) | fork + fault-free reconcile | system actions |
| I3 usage-hold drop | `pushDeprecateDropActions` | usage-hold scenario pin | known-seeds / usage pin |
| I4 indexable workload | `assertIndexableWorkload` (CI on APP_QUERIES) | n/a (authoring) | `indexability` |

## Adding a regression

1. Extend `tests/generators/statement-ast.ts` render helpers if SQL shape differs.
2. Pin a named scenario under `tests/scenario/` or a unit test under `tests/`.
3. Prefer sim / black-box pins over deep executor mocks.

```bash
bun pkgs/db-indexes/tests/mutants/scripted-mutants.ts
```
