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
  test('the shard matrix is the plan schedule, and a shard is numbered by its place in it', () => {
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
      on: {
        workflow_dispatch: { inputs: { shards: { options: number[] } } };
        workflow_call: { inputs: { shards: { default: number } } };
      };
      jobs: {
        'check-start': {
          outputs: Record<string, string>;
          steps: { id?: string; run?: string }[];
        };
        'check-shards': {
          name: string;
          needs: string[];
          if: string;
          env: Record<string, string>;
          strategy: { matrix: { shard: string } };
        };
      };
    };
    const start = workflow.jobs['check-start'];
    expect(start.outputs).toEqual({
      shards: '${{ steps.plan.outputs.shards }}',
    });
    expect(start.steps.find((step) => step.id === 'plan')?.run).toContain(
      'check-plan.ts'
    );
    const shards = workflow.jobs['check-shards'];
    expect(shards.needs).toEqual(['check-start']);
    // An empty matrix fails the workflow; a fully cached plan skips the job.
    expect(shards.if).toBe("needs.check-start.outputs.shards != '[]'");
    expect(shards.strategy.matrix.shard).toBe(
      '${{ fromJSON(needs.check-start.outputs.shards) }}'
    );
    // The matrix names no shard (`shardMatrix`), so nothing reads its values.
    expect(shards.name).toBe('check:shards (${{ strategy.job-index }})');
    expect(shards.env['CHECK_SHARD']).toBe('${{ strategy.job-index }}');
    expect(readFileSync(WORKFLOW, 'utf8')).not.toContain('matrix.shard');
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
          'continue-on-error'?: boolean;
          steps: {
            name?: string;
            if?: string;
            run?: string;
            uses?: string;
            env?: Record<string, string>;
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
    // Three jobs: the start, the shards and the ending word.
    expect(Object.keys(workflow.jobs)).toEqual([
      'check-start',
      'check-shards',
      'check-end',
    ]);
    const end = workflow.jobs['check-end']!;
    expect(end.needs).toEqual(['check-start', 'check-shards']);
    expect(end.if).toBe('always() && !cancelled()');
    expect(end['continue-on-error']).toBeUndefined();
    expect(workflow.jobs['check-start']!.if).toBeUndefined();
    expect(workflow.jobs['check-shards']!.strategy?.['fail-fast']).toBe(false);
    const step = (script: string) =>
      end.steps.findIndex((candidate) => candidate.run?.includes(script));
    // Fan-in suites still report when a shard is red; the verdict follows
    // them and reads every upstream job.
    const consumers = step('check-consumers.ts');
    const verdict = step('check-verdict.ts');
    const reports = step('check-reports.ts');
    expect(consumers).toBeGreaterThan(-1);
    expect(end.steps[consumers]!.if).toBeUndefined();
    expect(verdict).toBeGreaterThan(consumers);
    expect(end.steps[verdict]).toMatchObject({
      if: 'always() && !cancelled()',
      env: {
        START_RESULT: '${{ needs.check-start.result }}',
        SHARD_RESULT: '${{ needs.check-shards.result }}',
      },
    });
    expect(end.steps[verdict]!['continue-on-error']).toBeUndefined();
    // Publication comes after the verdict and cannot change the job's result.
    expect(reports).toBeGreaterThan(verdict);
    expect(end.steps[reports]).toMatchObject({
      if: 'always() && !cancelled()',
      'continue-on-error': true,
    });
    expect(
      end.steps.filter((candidate) => candidate['continue-on-error'])
    ).toHaveLength(1);
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
