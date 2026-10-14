import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { decodePlan, encodePlan } from './check-plan-transfer';

type Step = {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
};
type Job = { outputs?: Record<string, unknown>; steps: Step[] };

// regression: github-check-plan-output-secret-masking
test('Check transfers the immutable plan as an artifact rather than a masked job output', () => {
  // Run 37511860563 suppressed the plan output and supplied an empty payload.
  const text = readFileSync(
    join(import.meta.dirname, '../../../.github/workflows/check-pr.yml'),
    'utf8'
  );
  const { jobs } = Bun.YAML.parse(text) as { jobs: Record<string, Job> };
  // The one output is the shard matrix, which holds no plan data.
  expect(Object.keys(jobs['check-start']!.outputs ?? {})).toEqual(['shards']);
  const upload = jobs['check-start']!.steps.find(
    (step) =>
      step.uses === 'actions/upload-artifact@v6' &&
      step.with?.['name'] === 'check-plan'
  );
  expect(upload?.with?.['path']).toBe('.cache/check-ci/plan.payload');
  expect(upload?.with?.['overwrite']).toBe(true);
  expect(text).not.toContain('CHECK_PLAN_PAYLOAD');
  // regression: github-download-artifact-node20
  for (const [name, script] of [
    ['check-shards', 'check-stage-transfer.ts'],
    ['check-end', 'check-consumers.ts'],
  ] as const) {
    const steps = jobs[name]!.steps;
    const download = steps.findIndex(
      (step) =>
        step.uses === 'actions/download-artifact@v8' &&
        step.with?.['name'] === 'check-plan'
    );
    const restore = steps.findIndex((step) => step.run?.includes(script));
    expect(download).toBeGreaterThan(-1);
    expect(download).toBeLessThan(restore);
    expect(steps[download]?.with?.['path']).toBe('.cache/check-ci');
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
