# `@pkgs/pbt`

Thin fast-check wrapper for bun:test. Property tests are **additive** — never
delete an example-based regression test to make room for a property.

## Seed policy

| Mode | Behavior |
|------|----------|
| Default (local + CI) | Pinned `FC_SEED` (default `424242`) so PBT never looks like flake |
| Random / nightly | `PBT_RANDOM=1` omits the pinned seed |

```bash
# default pinned run
bun test pkgs/keyword/src/keyword.pbt.test.ts

# replay a failure
FC_SEED=123456789 bun test pkgs/keyword/src/keyword.pbt.test.ts

# random nightly (200 runs per property, files run in parallel)
bun run test:pbt:random

# hunt flakes: up to N independent suite runs, stop on first failure
bun run test:pbt:random 100

# cap parallel workers (default: CPU count)
bun run test:pbt:random --concurrency 8
```

Env knobs:

- `PBT_NUM_RUNS` — override `numRuns` (default `10` local / `40` when `CI=true`)
- `PBT_SAMPLE_RUNS` — override world-sample run count (default `6` local / `12` in CI)
- `PBT_SAMPLE_INTERRUPT_MS` — override world-sample fast-check interrupt (default `120000` when `PBT_RANDOM=1`, else `60000`)
- `PBT_CONCURRENCY` — parallel file workers for `test:pbt:random` (default `min(6, CPU count)`)
- `FC_SEED` — pin seed
- `PBT_RANDOM=1` — omit pinned seed

`test:pbt:random` discovers every `*.pbt.test.ts` under `pkgs/` and `libs/`, runs each file in its own `bun test` subprocess (bounded worker pool), and shows a compact live dashboard (attempt, seed, workers, progress). Full output is shown only for failures. Each attempt gets a random `FC_SEED` you can replay.

## World / DST properties

Sim-backed exploration lives in **`@pkgs/dst`**:
`explore(system, { properties, actions, episodes, steps })` runs script +
weighted `walk` + shrink. Scripted pins use `script` (or package helpers like
`scriptRoom`) with local seed arbitraries — not a deleted `arbSeed`.

For custom fast-check properties over seeds, use **`assertProperty`** from this
package (caps `numRuns` / interrupt for `test:pbt:random`):

```ts
import { assertProperty, fc } from '@pkgs/pbt';
import { explore, script } from '@pkgs/dst';
import { acmeSystem, ACME_ACTIONS, ACME_PROPERTIES } from '../apps/acme/system';

const report = await explore(acmeSystem, {
  properties: ACME_PROPERTIES,
  actions: ACME_ACTIONS,
  episodes: 12,
  steps: 14,
});
expect(report.ok).toBe(true);

const arbSeed = () => fc.integer({ min: 1, max: 2 ** 31 - 1 });
assertProperty(
  'app world starts',
  fc.asyncProperty(arbSeed(), async (seed) => {
    await using run = await script(acmeSystem, { seed });
    expect(run).toBeDefined();
  })
);
```

Replay a shrunk walk from failure output via `replay` from `@pkgs/dst`
(or package `replayRoom` / sync helpers).

## Writing a property

```ts
import { describe, test } from 'bun:test';
import { assertProperty, arbJsonValue, fc } from '@pkgs/pbt';
import { canonicalJson } from '../canonical';

describe('canonicalJson', () => {
  test('key insertion order does not change the digest', () => {
    assertProperty(
      'canonicalJson ignores key insertion order',
      fc.property(arbJsonValue(), (v) => {
        // ...
        return true;
      })
    );
  });
});
```

## Pinning a counterexample

When a property finds a real bug, pin it with `examples` so it always runs first:

```ts
assertProperty('…', fc.property(arb, (x) => /* … */), {
  examples: [[{ /* shrunk counterexample */ }]],
});
```

Log the seed + path + minimal case in repo-root `PBT_FINDINGS.md`.
**Do not silently fix production code** as part of a PBT overhaul unless asked.

## Model-based / commands

Use `fc.commands` + `fc.asyncModelRun` (or `fc.modelRun`) to shrink action
sequences. Keep the product `VirtualClock` / `createSimAdapters` — do **not**
replace the virtual clock with `fc.scheduler`.

Replay for commands also needs `replayPath` from the failure output:

```ts
fc.assert(fc.asyncProperty(fc.commands(cmds, { replayPath: '…' }), …), {
  seed: 123,
  path: '…',
});
```

## Shared arbitraries

Import from `@pkgs/pbt`:

- `arbJsonValue` / `arbJsonObject` / `arbJsonKey`
- `arbUserId` / `arbDistinctUserPair`
- `arbKebabSegment` / `arbNamespacedKeyword`
- `arbNdjsonFrame` / `arbChunkSplits`

Domain-specific generators live next to the package under test
(e.g. `pkgs/sync-engine/src/tests/arbitraries/`).
