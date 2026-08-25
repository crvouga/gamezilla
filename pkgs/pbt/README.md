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

# random nightly
bun run test:pbt:random
```

Env knobs:

- `PBT_NUM_RUNS` — override `numRuns` (default `10` local / `40` when `CI=true`)
- `FC_SEED` — pin seed
- `PBT_RANDOM=1` — omit pinned seed

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
