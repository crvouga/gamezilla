# Testing `@pkgs/db-indexes`

## Layers

| Layer | Path | Command |
| --- | --- | --- |
| Unit / contract / property | `tests/*.test.ts` | `bun run test` |
| Generators | `tests/generators` | imported by the property tests |
| Acceptance (Gherkin + Quint) | `specs/index-tuning/` (steps `tests/steps/`, binding `tests/quint/`) | `bun run test:e2e` |
| Mutants | `tests/mutants` | `bun run mutants` |

The tuning sim — one reconciler over `SimDb` on a virtual clock, with the
standing `tuningInvariantsHold` property — is `indexTuningSystem`, exported
from `@pkgs/db-indexes/sim`. `specs/index-tuning/index-tuning.feature` pins
the rules the team sees (declared lookups get tuned indexes, retiring keeps
used indexes, the team's own index is never touched);
`specs/index-tuning/index-tuning.qnt` walks any sequence of declaring,
tuning, uses, days passing and the team adding its own index, and the
product must match the model after every step. Its traces are drawn from
`FC_SEED` (`PBT_RANDOM=1` explores other seeds):

```bash
bun run spec specs/index-tuning/index-tuning.qnt
FC_SEED=42 bun run spec specs/index-tuning/index-tuning.qnt
```

## Invariant → assert / sim / property map

| Invariant | Prod assert | Sim check | Property / model |
| --- | --- | --- | --- |
| I1 owned-only DDL | `diffOwnedIndexes` + `reconcile` execute | `tuningInvariantsHold` | `ownership`, `index-tuning.qnt` (`teamIndex`) |
| I2 crash-converge | n/a (executor returns crashed) | n/a | not modeled |
| I3 usage-hold drop | `pushDeprecateDropActions` | `tuningInvariantsHold` (`I3_usage_hold`) | `index-tuning.qnt` (`use`, `retiring`), feature rule |
| I4 indexable workload | `assertIndexableWorkload` (CI on APP_QUERIES) | n/a (authoring) | `indexability` |

## Adding a regression

1. Extend `tests/generators/statement-ast.ts` render helpers if SQL shape differs.
2. Pin an example test under `tests/` marked `// regression: <bug-id>`, or,
   when the team could observe the bug, ask for a `@regression:<id>` scenario
   in `specs/index-tuning/`.
3. Prefer sim / black-box pins over deep executor mocks.

```bash
bun pkgs/db-indexes/tests/mutants/scripted-mutants.ts
```
