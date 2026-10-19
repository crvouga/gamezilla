import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertProperty } from '@pkgs/property-shared/assert-property';
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
test('Verification transfers the immutable plan as an artifact rather than a masked job output', () => {
  // Run 37511860563 suppressed the plan output and supplied an empty payload.
  const text = readFileSync(
    join(import.meta.dirname, '../../../.github/workflows/verify-pr.yml'),
    'utf8'
  );
  const { jobs } = Bun.YAML.parse(text) as { jobs: Record<string, Job> };
  // The one output is the shard matrix, which holds no plan data.
  expect(Object.keys(jobs['verify-start']!.outputs ?? {})).toEqual(['shards']);
  const upload = jobs['verify-start']!.steps.find(
    (step) =>
      step.uses === 'actions/upload-artifact@v6' &&
      step.with?.['name'] === 'verify-plan'
  );
  expect(upload?.with?.['path']).toBe('.cache/verify-ci/plan.payload');
  expect(upload?.with?.['overwrite']).toBe(true);
  expect(text).not.toContain('VERIFY_PLAN_PAYLOAD');
  // regression: github-download-artifact-node20
  for (const [name, script] of [
    ['verify-shards', 'verify-stage-transfer.ts'],
    ['verify-end', 'verify-consumers.ts'],
  ] as const) {
    const steps = jobs[name]!.steps;
    const download = steps.findIndex(
      (step) =>
        step.uses === 'actions/download-artifact@v8' &&
        step.with?.['name'] === 'verify-plan'
    );
    const restore = steps.findIndex((step) => step.run?.includes(script));
    expect(download).toBeGreaterThan(-1);
    expect(download).toBeLessThan(restore);
    expect(steps[download]?.with?.['path']).toBe('.cache/verify-ci');
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
