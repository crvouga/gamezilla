import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { decodePlan, encodePlan } from './verify-plan-transfer';

type Step = {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
};
type Job = { outputs?: Record<string, unknown>; steps: Step[] };

// regression: github-verify-plan-output-secret-masking
test('Verification transfers the immutable plan as a CI artifact rather than a masked job output', () => {
  // Run 37511860563 suppressed the plan output and supplied an empty payload.
  const text = readFileSync(
    join(import.meta.dirname, '../../../.github/workflows/verify-pr.yml'),
    'utf8'
  );
  const { jobs } = Bun.YAML.parse(text) as { jobs: Record<string, Job> };
  // The only output is the shard matrix, which holds no plan data.
  expect(Object.keys(jobs['verify-start']!.outputs ?? {})).toEqual(['shards']);
  const upload = jobs['verify-start']!.steps.find((step) =>
    step.run?.includes('scripts/ci-artifacts.ts upload verify-plan')
  );
  // An upload of a name replaces it (`ci-artifacts.ts`), so a rerun's
  // shards never read an earlier attempt's plan.
  expect(upload?.run?.trim().split(/\s+/).slice(-2)).toEqual([
    'verify-plan',
    '.cache/verify-ci/plan.payload',
  ]);
  expect(text).not.toContain('VERIFY_PLAN_PAYLOAD');
  for (const [name, script] of [
    ['verify-shards', 'verify-stage-transfer.ts'],
    ['verify-end', 'verify-consumers.ts'],
  ] as const) {
    const steps = jobs[name]!.steps;
    const download = steps.findIndex(
      (step) =>
        step.run?.trim() ===
        'bun run libs/tools-harness-ts/scripts/ci-artifacts.ts download verify-plan .cache/verify-ci'
    );
    const restore = steps.findIndex((step) => step.run?.includes(script));
    expect(download).toBeGreaterThan(-1);
    expect(download).toBeLessThan(restore);
  }
});

test('artifact transport preserves metadata containing arbitrary masked substrings', () => {
  assertProperty(
    'artifact contents do not rely on GitHub output filtering',
    fc.property(fc.jsonValue(), (value) => {
      const files = { 'context.json': JSON.stringify({ value }) };
      expect(decodePlan(encodePlan(files))).toEqual(files);
    })
  );
});
