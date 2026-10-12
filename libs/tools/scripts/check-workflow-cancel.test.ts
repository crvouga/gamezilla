import { describe, expect, test } from 'bun:test';

import { readdirSync, readFileSync } from 'node:fs';
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
  test('the shard matrix is the plan schedule, published by a job that holds no secrets', () => {
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
      on: {
        workflow_dispatch: { inputs: { shards: { options: number[] } } };
        workflow_call: { inputs: { shards: { default: number } } };
      };
      jobs: {
        'check-schedule': {
          needs: string[];
          outputs: Record<string, string>;
          steps: { uses?: string; run?: string }[];
        };
        'check-shards': {
          needs: string[];
          if: string;
          strategy: { matrix: { shard: string } };
        };
      };
    };
    const schedule = workflow.jobs['check-schedule'];
    expect(schedule.needs).toEqual(['check-plan']);
    expect(Object.keys(schedule.outputs)).toEqual(['shards', 'consumers']);
    // GitHub suppresses a job output written beside masked secrets.
    expect(schedule.steps.map((step) => step.uses ?? 'run')).toEqual([
      'actions/download-artifact@v6',
      'run',
    ]);
    expect(JSON.stringify(schedule)).not.toContain('secrets');
    const shards = workflow.jobs['check-shards'];
    expect(shards.needs).toEqual(['check-schedule']);
    // An empty matrix fails the workflow; a fully cached plan skips the job.
    expect(shards.if).toBe("needs.check-schedule.outputs.shards != '[]'");
    expect(shards.strategy.matrix.shard).toBe(
      '${{ fromJSON(needs.check-schedule.outputs.shards) }}'
    );
    const shardCounts = workflow.on.workflow_dispatch.inputs.shards.options;
    expect(shardCounts.every((count) => count >= 1 && count <= 64)).toBe(true);
    // The account runs 40 jobs at once (Check run 38187450396 started 40 of
    // 64 shards and queued the rest), so a higher cap only adds runner setups.
    expect(workflow.on.workflow_call.inputs.shards.default).toBe(40);
    expect(shardCounts).toContain(40);
  });
  test('no workflow explores: the gate replays its bounded traces on every trigger', () => {
    // `QUINT_REPLAY_TRACES` unset is the bounded default; exploring is asked
    // for by name on a developer machine.
    for (const file of readdirSync(join(WORKFLOW, '..')))
      expect(readFileSync(join(WORKFLOW, '..', file), 'utf8')).not.toContain(
        'QUINT_REPLAY_TRACES'
      );
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
      'check-schedule',
      'check-shards',
      'check-consumers',
    ]);
    expect(verify.if).toBe('always() && !cancelled()');
    expect(
      verify.steps.some((step) => step.run?.includes('check-verdict.ts'))
    ).toBe(true);
    expect(workflow.jobs['check-plan']!.if).toBeUndefined();
    expect(workflow.jobs['check-shards']!.strategy?.['fail-fast']).toBe(false);
    expect(workflow.jobs['check-shards']!.needs).toEqual(['check-schedule']);
    // Fan-in suites still report when a shard is red, and start no runner
    // when the plan left them nothing to execute.
    expect(workflow.jobs['check-consumers']!.needs).toEqual([
      'check-plan',
      'check-schedule',
      'check-shards',
    ]);
    expect(workflow.jobs['check-consumers']!.if).toBe(
      "always() && !cancelled() && needs.check-plan.result == 'success' && needs.check-schedule.outputs.consumers == 'true'"
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
