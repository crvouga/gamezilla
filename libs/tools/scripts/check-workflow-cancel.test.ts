import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOW = join(
  import.meta.dirname,
  '../../../.depot/workflows/check.yml'
);

/** Cleanup steps must not hold a cancelled run's concurrency group. */
function alwaysConditions(workflow: string): readonly string[] {
  return [...workflow.matchAll(/^\s+if: (.+)$/gm)].map(
    (match) => match[1] ?? ''
  );
}

describe('Check workflow cancellation', () => {
  // regression: check-duplicate-trigger-runners
  test('PR and manual triggers share the branch concurrency group', () => {
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
      concurrency: { group: string };
    };
    expect(workflow.concurrency.group).toBe(
      'check-${{ github.event.pull_request.head.ref || github.ref_name }}'
    );
  });
  // regression: check-cancel-holds-concurrency
  test('publish and the verdict skip a cancelled run', () => {
    const holding = alwaysConditions(readFileSync(WORKFLOW, 'utf8')).filter(
      (condition) => condition.includes('always()')
    );
    expect(holding.length).toBeGreaterThan(0);
    expect(
      holding.every((condition) => condition === 'always() && !cancelled()')
    ).toBe(true);
  });

  test('the required gate verifies all independent shards and never waits for publication', () => {
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
      jobs: Record<
        string,
        {
          needs?: string[] | string;
          name: string;
          strategy?: { 'fail-fast': boolean };
          steps: { run?: string }[];
        }
      >;
    };
    const gate = workflow.jobs['check']!;
    expect(gate.needs).toEqual(['check-plan', 'check-shards']);
    expect(gate.steps[0]!.run).toContain('test "$PLAN_RESULT" = success');
    expect(gate.steps[0]!.run).toContain('test "$SHARD_RESULT" = success');
    expect(workflow.jobs['check-shards']!.strategy?.['fail-fast']).toBe(false);
    expect(workflow.jobs['check-reports']!.needs).toEqual([
      'check-plan',
      'check-shards',
    ]);
    expect(gate.needs).not.toContain('check-reports');
  });
});
