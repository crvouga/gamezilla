# Testing `@pkgs/db-indexes`

## Layers

| Layer | Path | Command |
| --- | --- | --- |
| Unit / contract / property | `tests/*.test.ts` | `bun run test` |
| Model-based (index tuning) | `tests/index-tuning.property.test.ts` | `bun run test` |
| Gherkin maintenance specifications | `specs/db-indexes/*.feature`, `tests/steps/` | `bun run test:spec` |
| Quint implementation replay | `specs/db-indexes/*.qnt`, `tests/quint/` | `bun run test:spec` |
| Bounded exhaustive model checks | `specs/db-indexes/*.qnt` | `bun run check:models` |
| Generators | `tests/generators` | imported by the property tests |
| Mutants | `tests/mutants` | `bun run mutants` |

All executable specifications live in the isolated
[Database indexing context](../../../specs/db-indexes/), registered to this
package. The shared runners generate conformance evidence from the root specs.
Pure computations, port contracts and supplementary generated agreement checks
remain package tests.

The technical contract, bounds, coverage and outstanding safety evidence are in
[SAFETY_CONTRACT.md](./SAFETY_CONTRACT.md). Its runners use public exports and
virtual clocks; the bundled CLI and pinned checker are documented in
[@pkgs/quint](../../quint/README.md).
`tests/index-tuning.property.test.ts` generates sequences of declaring
lookups, tuning, uses, days passing and the team adding its own index, and
runs each against the harness and a reference model of the tuning rules:

- every declared lookup gets a tuned index when tuning runs;
- tuning again with nothing new to do changes nothing;
- a tuned index no declared lookup needs starts retiring and stays;
- a retiring index unused for a whole retirement window is removed;
- declaring its lookup again stops an index retiring;
- a retiring index used during its window is kept (its window restarts);
- tuning never touches the team's own index, however long it goes unused.

After every step the harness and the model agree on the tuned indexes, which
are retiring, their use counts and the team's own index; the model's
invariants hold (only tuned indexes retire, a use count for every tuned
index, every retirement window has begun); and the same sequence replayed on
a fresh harness ends in the same state. It runs on the pinned seed
(`PBT_RANDOM=1 bun run test` explores others).

## Invariant → assert / harness / property map

| Invariant | Prod assert | Harness check | Property / model |
| --- | --- | --- | --- |
| I1 owned-only DDL | `diffOwnedIndexes` + `reconcile` execute | `tuningInvariantsHold` | `ownership`, `index-tuning.property` (team's own index) |
| I2 crash-converge | n/a (executor returns crashed) | `indexSafetySystem` | `execution.feature`, `persisted-interruption.feature`, `index-interruption.qnt` (limits in the safety contract) |
| I3 usage-hold drop | `pushDeprecateDropActions` | `tuningInvariantsHold` (`I3_usage_hold`) | `index-tuning.property` (uses, retiring) |
| I4 indexable workload | `assertIndexableWorkload` (CI on APP_QUERIES) | n/a (authoring) | `indexability` |

## Adding a regression

1. Extend `tests/generators/statement-ast.ts` render helpers if SQL shape differs.
2. Pin an example test under `tests/` marked `// regression: <bug-id>`, with
   its entry in `libs/tools/goal/known-bugs.json`.
3. Prefer harness / black-box pins over deep executor mocks.

```bash
bun pkgs/db-indexes/tests/mutants/scripted-mutants.ts
```
