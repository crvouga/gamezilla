import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const workflow = Bun.YAML.parse(
  readFileSync(
    join(import.meta.dirname, '../../../.github/workflows/health.yml'),
    'utf8'
  )
) as {
  jobs: Record<string, { if?: string; needs?: string[] }>;
};

function runsObjective(ref: string, cancelled = false, envs = '["dev","prd"]') {
  const condition = workflow.jobs['health-objectives']!.if!;
  // Evaluate the workflow's conjunction of these three context predicates.
  // Reject unfamiliar syntax so a workflow change cannot silently pass.
  const predicates: Record<string, boolean> = {
    '!cancelled()': !cancelled,
    "github.ref == 'refs/heads/main'": ref === 'refs/heads/main',
    "needs.health-matrix.outputs.all != '[]'": envs !== '[]',
  };
  const clauses = condition.replace(/^\$\{\{\s*|\s*\}\}$/g, '').split(' && ');
  for (const clause of clauses) {
    if (!Object.hasOwn(predicates, clause))
      throw new Error(`Unsupported Health condition: ${clause}`);
  }
  return clauses.every((clause) => predicates[clause]);
}

// regression: health-objectives-on-pull-request
test('historical availability does not mark the hosting fix PR as failed', () => {
  expect(runsObjective('refs/heads/fix/health-objectives-host-space')).toBe(
    false
  );
  expect(runsObjective('refs/pull/149/merge')).toBe(false);
});

test('only main measures historical availability for every nonempty environment set', () => {
  assertProperty(
    'historical availability belongs to main',
    fc.property(
      fc.oneof(fc.constant('refs/heads/main'), fc.string()),
      fc.boolean(),
      fc.boolean(),
      (ref, cancelled, hasEnvs) => {
        expect(runsObjective(ref, cancelled, hasEnvs ? '["dev"]' : '[]')).toBe(
          ref === 'refs/heads/main' && !cancelled && hasEnvs
        );
      }
    )
  );
});

test('main still measures after live probes finish and branch probes remain enabled', () => {
  expect(workflow.jobs['health-objectives']!.needs).toEqual([
    'health-matrix',
    'health-env',
  ]);
  expect(workflow.jobs['health-env']!.if).toBe(
    "needs.health-matrix.outputs.all != '[]'"
  );
  expect(runsObjective('refs/heads/main')).toBe(true);
});
