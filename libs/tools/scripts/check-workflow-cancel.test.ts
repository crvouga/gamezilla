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
  test('every configurable shard count has exactly its complete matrix of owners', () => {
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
      on: {
        workflow_dispatch: { inputs: { shards: { options: number[] } } };
        workflow_call: { inputs: { shards: { default: number } } };
      };
      jobs: { 'check-shards': { strategy: { matrix: { shard: string } } } };
    };
    const expression = workflow.jobs['check-shards'].strategy.matrix.shard;
    const presets = JSON.parse(
      /fromJSON\('([^']+)'\)/.exec(expression)![1]!
    ) as Record<string, number[]>;
    const shardCounts = workflow.on.workflow_dispatch.inputs.shards.options;
    for (const count of shardCounts)
      expect(presets[String(count)]).toEqual(
        Array.from({ length: count }, (_, index) => index)
      );
    expect(Object.keys(presets).map(Number)).toEqual(shardCounts);
    expect(workflow.on.workflow_call.inputs.shards.default).toBe(32);
  });
  // regression: concurrent-check-run-isolation
  test('a newer push supersedes its PR run; dispatched and release runs never cancel one another', () => {
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
      concurrency: { group: string; 'cancel-in-progress': string };
    };
    expect(workflow.concurrency.group).toBe(
      "${{ github.event_name == 'pull_request' && format('check-pr-{0}', github.event.pull_request.number) || format('check-run-{0}', github.run_id) }}"
    );
    expect(workflow.concurrency['cancel-in-progress']).toBe(
      "${{ github.event_name == 'pull_request' }}"
    );
  });
  // regression: check-cancel-holds-concurrency
  test('publish and the verdict skip a cancelled run', () => {
    const holding = alwaysConditions(readFileSync(WORKFLOW, 'utf8')).filter(
      (condition) => condition.includes('always()')
    );
    expect(holding.length).toBeGreaterThan(0);
    expect(
      holding.every((condition) =>
        condition.startsWith('always() && !cancelled()')
      )
    ).toBe(true);
  });

  // regression: check-evidence-masks-required-verdict (invalid/name artifact)
  test('the required gate is the full verdict on every trigger, never publication', () => {
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
      on: {
        pull_request: { branches: string[]; types: string[] };
      };
      jobs: Record<
        string,
        {
          needs?: string[] | string;
          if?: string;
          name: string;
          strategy?: { 'fail-fast': boolean };
          steps: {
            name?: string;
            if?: string;
            run?: string;
            uses?: string;
            'continue-on-error'?: boolean;
          }[];
        }
      >;
    };
    // Every push to a pull request on main runs the whole gate.
    expect(workflow.on.pull_request).toEqual({
      branches: ['main'],
      types: ['opened', 'reopened', 'synchronize'],
    });
    const gate = workflow.jobs['check']!;
    expect(gate.needs).toEqual(['check-verify']);
    expect(gate.if).toBe('always() && !cancelled()');
    const require = gate.steps.find(
      (step) => step.name === 'Require release verification'
    )!;
    expect(require.if).toBeUndefined();
    expect(require.run).toBe('test "$VERIFY_RESULT" = success');
    expect(gate.steps.find((step) => step.name === 'check')).toBeUndefined();

    const verify = workflow.jobs['check-verify']!;
    expect(verify.needs).toEqual([
      'check-plan',
      'check-shards',
      'check-consumers',
    ]);
    expect(verify.if).toBe('always() && !cancelled()');
    expect(
      verify.steps.some((step) => step.run?.includes('check-verdict.ts'))
    ).toBe(true);
    expect(workflow.jobs['check-plan']!.if).toBeUndefined();
    expect(workflow.jobs['check-shards']!.strategy?.['fail-fast']).toBe(false);
    expect(workflow.jobs['check-shards']!.needs).toEqual(['check-plan']);
    // Fan-in suites still report when a shard is red.
    expect(workflow.jobs['check-consumers']!.needs).toEqual([
      'check-plan',
      'check-shards',
    ]);
    expect(workflow.jobs['check-consumers']!.if).toBe(
      "always() && !cancelled() && needs.check-plan.result == 'success'"
    );
    expect(workflow.jobs['check-reports']!.needs).toEqual([
      'check-plan',
      'check-shards',
      'check-consumers',
    ]);
    expect(gate.needs).not.toContain('check-reports');
    expect(verify.needs).not.toContain('check-reports');
    expect(workflow.jobs['check-reports']!.if).toBe('always() && !cancelled()');
    // regression: check-repeated-mise-cache-stall (1jzx5994v8)
    expect(
      workflow.jobs['check-shards']!.steps.filter(
        (step) =>
          step.uses === './.github/actions/setup' ||
          step.uses === 'jdx/mise-action@v4'
      )
    ).toHaveLength(1);
    expect(
      workflow.jobs['check-shards']!.steps.find(
        (step) => step.name === 'Transfer raw evidence'
      )?.['continue-on-error']
    ).toBeUndefined();
    expect(
      workflow.jobs['check-shards']!.steps.find(
        (step) => step.name === 'check'
      )?.['continue-on-error']
    ).toBeUndefined();
  });
});
