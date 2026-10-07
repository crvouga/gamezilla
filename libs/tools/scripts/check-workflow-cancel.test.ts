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
      on: { workflow_dispatch: { inputs: { shards: { options: number[] } } } };
      jobs: { 'check-shards': { strategy: { matrix: { shard: string } } } };
    };
    const expression = workflow.jobs['check-shards'].strategy.matrix.shard;
    const presets = JSON.parse(
      /fromJSON\('([^']+)'\)/.exec(expression)![1]!
    ) as Record<string, number[]>;
    for (const count of workflow.on.workflow_dispatch.inputs.shards.options)
      expect(presets[String(count)]).toEqual(
        Array.from({ length: count }, (_, index) => index)
      );
    expect(Object.keys(presets).map(Number)).toEqual(
      workflow.on.workflow_dispatch.inputs.shards.options
    );
  });
  // regression: check-duplicate-trigger-runners
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
  test('the required gate is the PR gate or the full verdict, never publication', () => {
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
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
    const gate = workflow.jobs['check']!;
    expect(gate.needs).toEqual(['check-verify']);
    expect(gate.if).toBe('always() && !cancelled()');
    const require = gate.steps.find(
      (step) => step.name === 'Require release verification'
    )!;
    expect(require.if).toBe("env.CHECK_SCOPE == 'full'");
    expect(require.run).toBe('test "$VERIFY_RESULT" = success');
    const fast = gate.steps.find((step) => step.name === 'check')!;
    expect(fast.if).toBe("env.CHECK_SCOPE != 'full'");
    expect(fast.run).toContain('turbo-ci-run.ts //#check:pr');
    expect(fast['continue-on-error']).toBeUndefined();

    const verify = workflow.jobs['check-verify']!;
    expect(verify.needs).toEqual([
      'check-plan',
      'check-shards',
      'check-consumers',
    ]);
    expect(verify.if).toBe(
      "always() && !cancelled() && inputs.scope == 'full'"
    );
    expect(
      verify.steps.some((step) => step.run?.includes('check-verdict.ts'))
    ).toBe(true);
    expect(workflow.jobs['check-plan']!.if).toBe("inputs.scope == 'full'");
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
    // Reports are too slow for every push; full runs publish them.
    expect(workflow.jobs['check-reports']!.if).toBe(
      "always() && !cancelled() && inputs.scope == 'full'"
    );
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
