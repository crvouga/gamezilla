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
- `PBT_DST_RUNS` — override DST world run count (default `6` local / `12` in CI)
- `PBT_DST_INTERRUPT_MS` — override DST fast-check interrupt (default `120000` when `PBT_RANDOM=1`, else `60000`)
- `PBT_CONCURRENCY` — parallel file workers for `test:pbt:random` (default `min(6, CPU count)`)
- `FC_SEED` — pin seed
- `PBT_RANDOM=1` — omit pinned seed

`test:pbt:random` discovers every `*.pbt.test.ts` under `pkgs/` and `libs/`, runs each file in its own `bun test` subprocess (bounded worker pool), and shows a compact live dashboard (attempt, seed, workers, progress). Full output is shown only for failures. Each attempt gets a random `FC_SEED` you can replay.

## SimWorld DST properties

For `@pkgs/sync-engine` (and similar sim-backed suites), use `assertDstProperty`
instead of `assertProperty`. It caps `numRuns` and extends the interrupt budget
so `test:pbt:random` cannot accidentally run hundreds of full-world opens.

```ts
import { assertDstProperty, fc } from '@pkgs/pbt';
import { acmeDstApp } from '../apps/acme/dst-app';
import { worldPropertyInputs, runShrunkWorldProperty } from '../dst/world-runner';

await assertDstProperty(
  'app world converges',
  fc.asyncProperty(worldPropertyInputs(acmeDstApp, 14), async ([seed, knobs, cmds]) => {
    await runShrunkWorldProperty({ app: acmeDstApp, seed, knobs, cmds });
  })
);
```

Replay a shrunk command sequence from failure output:

```bash
FC_SEED=424242 bun test pkgs/sync-engine/src/tests/scenarios/acme-world.pbt.test.ts
# also capture replayPath from the fc.commands failure and pass to fc.commands({ replayPath })
```

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
sequences. Keep the product `SimClock` / `createSimAdapters` — do **not**
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
