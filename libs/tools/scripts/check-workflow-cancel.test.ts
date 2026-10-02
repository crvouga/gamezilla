import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOW = join(
  import.meta.dirname,
  '../../../.github/workflows/check.yml'
);

/** Job-level `if:` lines (4-space indent). Step conditions sit deeper. */
function jobConditions(workflow: string): readonly string[] {
  return [...workflow.matchAll(/^ {4}if: (.+)$/gm)].map(
    (match) => match[1] ?? ''
  );
}

describe('Check workflow cancellation', () => {
  // regression: check-cancel-holds-concurrency
  test('publish and the verdict skip a cancelled run', () => {
    const holding = jobConditions(readFileSync(WORKFLOW, 'utf8')).filter(
      (condition) => condition.includes('always()')
    );
    expect(holding).toEqual(['always() && !cancelled()']);
  });

  test('publishes in each shard and requires publication before the aggregate verdict', () => {
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
      jobs: Record<
        string,
        {
          needs?: string[];
          steps: {
            name?: string;
            run?: string;
            'continue-on-error'?: boolean;
          }[];
        }
      >;
    };
    expect(Object.keys(workflow.jobs)).toEqual([
      'check-plan',
      'check-matrix',
      'check-shard',
      'check',
    ]);
    const shard = workflow.jobs['check-shard'];
    expect(shard?.steps.find((step) => step.name === 'check')?.run).toContain(
      '--publish-reports'
    );
    const gate = workflow.jobs['check'];
    expect(gate?.needs).toContain('check-shard');
    const close = gate?.steps.find(
      (step) => step.name === 'Complete spec report'
    );
    expect(close?.run).toContain('report-publish.ts close');
    expect(close?.['continue-on-error']).toBeUndefined();
  });
});
