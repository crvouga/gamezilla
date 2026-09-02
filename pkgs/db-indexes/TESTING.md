# Testing `@pkgs/db-indexes`

## Layers

| Layer | Path | Command |
| --- | --- | --- |
| Unit | `src/tests/unit` | `bun test` |
| Generators | `src/tests/generators` | imported by PBT |
| Analyzer PBT | `src/tests/pbt` | `bun test` |
| DST / system | `src/tests/system` | `bun test` / `bun run test:sim` |
| Integration | `src/tests/integration` | `bun test` (PG live needs `DATABASE_URL`) |
| Perf soft gates | `src/tests/perf` | `bun test` |
| Soak | replay CLI | `bun run sim:soak` (not in `//#check`) |

## Replay a seed

```bash
bun run --filter @pkgs/db-indexes sim:replay 42
# or
INDEXES_SIM_SEED=42 bun test src/tests/scenario/known-seeds.sim.test.ts
```

Persist new failure seeds in `src/tests/scenario/known-seeds.txt` (always run first).

## Soak

```bash
INDEXES_SOAK_MS=60000 bun run --filter @pkgs/db-indexes sim:soak
```

## Invariant → assert / sim / property map

| Invariant | Prod assert | Sim check | Property |
| --- | --- | --- | --- |
| I1 owned-only DDL | `diffOwnedIndexes` + `reconcile` execute | `checkInvariantsAsync` + harness | `ownership.pbt` |
| I2 crash-converge | n/a (executor returns crashed) | fork + fault-free reconcile | system actions |
| I3 usage-hold drop | `pushDeprecateDropActions` | usage-hold in harness | known-seeds / usage test |
| I4 indexable workload | `assertIndexableWorkload` (CI on APP_QUERIES) | n/a (authoring) | `indexability.pbt` |
| I5 scoped unless catalog | unfiltered path → catalog allowlist only | n/a (authoring) | `indexability.pbt` |
| Fixpoint | n/a | harness + settle | `idempotence.pbt` |
| Budget | consolidate | `checkInvariantsAsync` | `budget-gates.pbt` |
| Determinism | sort canonicalize | seed replay | `determinism.pbt` |

## Adding a generator for a new dialect

1. Extend `src/tests/generators/statement-ast.ts` render helpers if SQL shape differs.
2. Keep `RecordingPort.parseStatement` dialect arg aligned with the port under test.
3. Add a thin differential under `src/tests/integration/` (≤20 scenarios total).

## Scripted mutants

```bash
bun pkgs/db-indexes/src/tests/mutants/scripted-mutants.ts
```

See `PHASE0.md` for purity findings and `bugs-found.md` for pinned product bugs.
