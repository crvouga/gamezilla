import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOW = join(
  import.meta.dirname,
  '../../../.github/workflows/check.yml'
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

  test('one Depot job includes publication in its required verdict', () => {
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
      jobs: Record<
        string,
        {
          needs?: string[];
          'runs-on': string;
          steps: {
            name?: string;
            run?: string;
            'continue-on-error'?: boolean;
          }[];
        }
      >;
    };
    expect(Object.keys(workflow.jobs)).toEqual(['check']);
    const gate = workflow.jobs['check'];
    expect(gate?.['runs-on']).toBe('depot-ubuntu-24.04-16');
    const check = gate?.steps.find((step) => step.name === 'check');
    expect(check?.run).toContain('--publish-reports');
    expect(check?.run).toContain('check');
    expect(check?.['continue-on-error']).toBeUndefined();
    expect(gate?.needs).toBeUndefined();
  });
});
