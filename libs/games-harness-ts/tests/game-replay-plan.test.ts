import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReplayPlan } from '@pkgs/quint-server-ts/trace-runs';
import { packageSpecUnits } from '../../harness-ts/scripts/replay-plans';
import { partOf } from '../../harness-ts/scripts/spec-parts';
import { packageSpecs } from '../../harness-ts/scripts/spec-sources';
import { conformanceVariants } from './conformance-world';

const ROOT = join(import.meta.dir, '../../..');
const PACKAGE = join(import.meta.dir, '..');
const plans = JSON.parse(
  readFileSync(join(import.meta.dir, 'quint/replays.json'), 'utf8')
) as Record<string, ReplayPlan>;

// regression: game-mode-replay-plan-variant-count
test('parts 88 and 89 of the 95-part game suite contain real verification work', () => {
  const count = 95;
  const units = packageSpecUnits(PACKAGE, packageSpecs(PACKAGE, ROOT), count);
  for (const index of [88, 89])
    expect(partOf(units, { index, count }).length).toBeGreaterThan(0);
});

test.each(Object.entries(plans))(
  '%s replay plan counts all current registered variants',
  (model, plan) => {
    const actual =
      'instances' in plan
        ? plan.instances.reduce(
            (count, instance) => count + instance.plan.variants,
            0
          )
        : plan.variants;
    expect(actual).toBe(conformanceVariants(`specs/games/${model}.qnt`).length);
  }
);
