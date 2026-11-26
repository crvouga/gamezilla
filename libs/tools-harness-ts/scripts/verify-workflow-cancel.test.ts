import { describe, expect, test } from 'bun:test';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { activeProfile } from './verify-profile';

const WORKFLOW = join(
  import.meta.dirname,
  '../../../.github/workflows/verify-full.yml'
);

/** Cleanup steps must not hold a cancelled run's concurrency group. */
function alwaysConditions(workflow: string): readonly string[] {
  return [...workflow.matchAll(/^\s+if: (.+)$/gm)].map(
    (match) => match[1] ?? ''
  );
}

describe('Verify workflow cancellation', () => {
  test('the shard matrix is the plan schedule, and a shard is numbered by its place in it', () => {
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
      env: Record<string, string>;
      on: {
        workflow_dispatch: { inputs: { shards: { options: number[] } } };
        workflow_call: { inputs: { shards: { default: number } } };
      };
      jobs: {
        'verify-start': {
          outputs: Record<string, string>;
          steps: { id?: string; run?: string }[];
        };
        'verify-shards': {
          name: string;
          needs: string[];
          if: string;
          env: Record<string, string>;
          concurrency: { group: string; queue: string };
          strategy: { matrix: { shard: string } };
        };
      };
    };
    const start = workflow.jobs['verify-start'];
    // The shards and the end run on the image the plan was made on
    // (workflow-native.test.ts), so the plan is the start's only output.
    expect(start.outputs).toEqual({
      shards: '${{ steps.plan.outputs.shards }}',
      consumers: '${{ steps.plan.outputs.consumers }}',
    });
    expect(start.steps.find((step) => step.id === 'plan')?.run).toContain(
      'verify-plan.ts'
    );
    const shards = workflow.jobs['verify-shards'];
    expect(shards.needs).toEqual(['verify-start']);
    // An empty matrix fails the workflow; a fully cached plan skips the job.
    expect(shards.if).toBe("needs.verify-start.outputs.shards != '[]'");
    expect(shards.strategy.matrix.shard).toBe(
      '${{ fromJSON(needs.verify-start.outputs.shards) }}'
    );
    // The matrix selects the shared slot. The job index identifies the shard.
    expect(shards.name).toBe('verify:shards (${{ strategy.job-index }})');
    expect(shards.env['VERIFY_SHARD']).toBe('${{ strategy.job-index }}');
    expect(shards.concurrency).toEqual({
      group:
        "${{ inputs.deployment && 'verify-production-shard' || 'verify-full-shard' }}-${{ matrix.shard['-'] }}",
      queue: 'max',
    });
    const shardCounts = workflow.on.workflow_dispatch.inputs.shards.options;
    expect(shardCounts.every((count) => count >= 1 && count <= 64)).toBe(true);
    // Verify run 38328597240 missed every cache. Twenty-seven solver runners
    // inside a cap of 40 packed the rest to 376s, and those shards were still
    // running at the 1200s deadline. The account runs about 40 jobs at once
    // (Verify run 38187450396); the extra runners queue, and each one is small
    // enough to finish once it starts.
    expect(workflow.on.workflow_call.inputs.shards.default).toBe(64);
    expect(workflow.env['VERIFY_SHARDS']).toContain("'64'");
    expect(shardCounts).toContain(64);
  });
  test('no workflow names a depth: the profile decides, and only a caller can ask for nightly', () => {
    // `QUINT_REPLAY_TRACES` unset is the bounded default. A workflow names a
    // profile and `verify-profile.ts` holds its budgets, so a pull request and
    // Release's verification share one verdict and one cache key.
    for (const file of readdirSync(join(WORKFLOW, '..')))
      expect(readFileSync(join(WORKFLOW, '..', file), 'utf8')).not.toMatch(
        /QUINT_REPLAY_TRACES|PBT_NUM_RUNS|FC_SEED/
      );
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
      env: Record<string, string>;
      on: {
        workflow_dispatch: { inputs: Record<string, unknown> };
        workflow_call: { inputs: { profile: { default: string } } };
      };
    };
    // A pull request has no inputs, and a dispatch cannot name a profile.
    expect(workflow.env['VERIFY_PROFILE']).toBe(
      "${{ inputs.profile || 'release' }}"
    );
    expect(workflow.on.workflow_call.inputs.profile.default).toBe('release');
    expect(workflow.on.workflow_dispatch.inputs).not.toHaveProperty('profile');
    expect(activeProfile({}).env).toEqual({});
  });
  // The merge gate keeps no test report; the job log is the evidence.
  test('the release profile uploads only transfer artifacts and deletes them', () => {
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
      jobs: Record<
        string,
        {
          steps: {
            name?: string;
            if?: string;
            run?: string;
            uses?: string;
            with?: Record<string, string>;
          }[];
        }
      >;
    };
    const nightlyOnly = (step: { if?: string }) =>
      step.if === "always() && !cancelled() && env.VERIFY_PROFILE == 'nightly'";
    const steps = Object.values(workflow.jobs).flatMap((job) => job.steps);
    const uploadOf = (step: {
      uses?: string;
      with?: Record<string, string>;
    }) =>
      step.uses?.startsWith('actions/upload-artifact@')
        ? step.with?.['name']
        : undefined;
    const uploads = steps.filter((step) => uploadOf(step) !== undefined);
    expect(uploads.length).toBeGreaterThan(0);
    // The one file a Release keeps past `verify:end`: its verdict job files
    // an issue per failing check from it (`ci-check-issues.ts`).
    const releaseVerdict = uploads.filter(
      (upload) => uploadOf(upload) === 'release-verdict'
    );
    expect(releaseVerdict.map((upload) => upload.if)).toEqual([
      "always() && !cancelled() && env.VERIFY_CI_STAGE == 'release'",
    ]);
    for (const upload of uploads) {
      if (nightlyOnly(upload) || releaseVerdict.includes(upload)) continue;
      // What remains carries state between jobs until `verify:end`.
      expect(uploadOf(upload)).toMatch(/^verify-(plan|results|evidence)/);
    }
    // Traces, summaries and retained verdicts are the nightly profile's.
    for (const name of [
      'observability-traces-',
      'turbo-summary-',
      'verify-verdict',
      'verify-ci-details',
    ])
      expect(
        uploads
          .filter((upload) => uploadOf(upload)?.startsWith(name))
          .every(nightlyOnly)
      ).toBe(true);
    const end = workflow.jobs['verify-end']!.steps;
    expect(end.at(-1)?.name).toBe(
      'Confirm completion within the workflow deadline'
    );
    const cleanup = end.at(-2)!;
    expect(cleanup.name).toBe('Delete transfer artifacts');
    // regression: verify-rerun-missing-plan
    expect(cleanup.if).toBe("success() && env.VERIFY_CI_STAGE == 'release'");
    expect(cleanup.run?.trim()).toBe(
      'bun run libs/tools-harness-ts/scripts/ci-artifacts.ts delete verify-'
    );
  });
  // regression: concurrent-verify-run-isolation
  test('only repeat validations of the same PR or the same branch and settings supersede work', () => {
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
      concurrency: { group: string; 'cancel-in-progress': string };
    };
    expect(workflow.concurrency.group).toBe(
      "${{ (github.workflow == 'Verify Full' && github.event_name == 'workflow_dispatch' && format('verify-dispatch-{0}-{1}-{2}-{3}', inputs.cache-mode, inputs.shards, inputs.concurrency, github.ref)) || format('verify-run-{0}', github.run_id) }}"
    );
    expect(workflow.concurrency['cancel-in-progress']).toBe(
      "${{ github.workflow == 'Verify Full' && github.event_name == 'workflow_dispatch' }}"
    );
  });
  // regression: release-cold-slow-suites
  test('a pull request runs the gate Release runs, so Release restores it', () => {
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
      env: Record<string, string>;
      on: { workflow_call: { inputs: { profile: { default: string } } } };
    };
    // Release passes `profile: release`; a pull request has no inputs. Both
    // land on the same profile, so every task hash, `VERIFY_PROFILE`
    // included, is the one the other wrote to the remote cache.
    expect(workflow.env['VERIFY_PROFILE']).toBe(
      "${{ inputs.profile || 'release' }}"
    );
    expect(workflow.on.workflow_call.inputs.profile.default).toBe('release');
    const deploy = Bun.YAML.parse(
      readFileSync(join(WORKFLOW, '..', 'deploy.yml'), 'utf8')
    ) as { jobs: { 'deploy-verify': { with: Record<string, unknown> } } };
    expect(deploy.jobs['deploy-verify'].with['profile']).toBe('release');
  });
  // regression: release-costs-erased-by-pr-profile
  test('each profile packs by its own measured durations', () => {
    const workflow = Bun.YAML.parse(readFileSync(WORKFLOW, 'utf8')) as {
      jobs: Record<
        string,
        { steps: { uses?: string; with?: Record<string, string> }[] }
      >;
    };
    const cacheSteps = Object.values(workflow.jobs).flatMap((job) =>
      job.steps.filter((step) => step.uses?.startsWith('actions/cache/'))
    );
    expect(cacheSteps).toHaveLength(2);
    const key =
      'verify-task-costs-v2-${{ env.VERIFY_PROFILE }}-${{ github.run_id }}-${{ github.run_attempt }}';
    for (const step of cacheSteps) expect(step.with?.['key']).toBe(key);
    expect(cacheSteps[0]!.with?.['restore-keys']).toBe(
      'verify-task-costs-v2-${{ env.VERIFY_PROFILE }}-'
    );
  });
  // regression: verify-cancel-holds-concurrency
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

  // regression: verify-evidence-masks-required-verdict (invalid/name artifact)
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
          strategy?: { 'fail-fast': string };
          'continue-on-error'?: boolean;
          steps: {
            name?: string;
            if?: string;
            run?: string;
            uses?: string;
            env?: Record<string, string>;
            with?: Record<string, string>;
            'continue-on-error'?: boolean;
          }[];
        }
      >;
    };
    // Every push to a pull request on main runs the pull-request gate.
    const prWorkflow = Bun.YAML.parse(
      readFileSync(join(WORKFLOW, '..', 'verify-pr.yml'), 'utf8')
    ) as typeof workflow;
    expect(Object.keys(prWorkflow.jobs)).toEqual(['verify-end']);
    expect(Object.keys(prWorkflow.on)).toEqual(['pull_request']);
    expect(workflow.on.pull_request).toBeUndefined();
    expect(prWorkflow.on.pull_request).toEqual({
      branches: ['main'],
      types: ['opened', 'reopened', 'synchronize'],
    });
    // Three jobs, all on Linux: the start, the shards and the ending word.
    expect(Object.keys(workflow.jobs)).toEqual([
      'verify-start',
      'verify-shards',
      'verify-end',
    ]);
    const end = workflow.jobs['verify-end']!;
    expect(end.needs).toEqual(['verify-start', 'verify-shards']);
    expect(end.if).toBe('always() && !cancelled()');
    expect(end['continue-on-error']).toBeUndefined();
    expect(workflow.jobs['verify-start']!.if).toBeUndefined();
    expect(workflow.jobs['verify-shards']!.strategy?.['fail-fast']).toBe(
      "${{ github.workflow == 'Release' }}"
    );
    const step = (script: string) =>
      end.steps.findIndex((candidate) => candidate.run?.includes(script));
    // Fan-in suites still report when a shard is red; the verdict follows
    // them and reads every upstream job.
    const consumers = step('verify-consumers.ts');
    const verdict = step('verify-verdict.ts');
    expect(consumers).toBeGreaterThan(-1);
    expect(end.steps[consumers]!.if).toContain("github.workflow != 'Release'");
    expect(end.steps[consumers]!.if).toContain(
      "needs.verify-start.result == 'success'"
    );
    const pr = prWorkflow.jobs['verify-end']!.steps.find((s) =>
      s.run?.includes('turbo-ci-run.ts verify:ci')
    )!;
    expect(pr.if).toBeUndefined();
    expect(pr['continue-on-error']).toBeUndefined();
    expect(verdict).toBeGreaterThan(consumers);
    expect(end.steps[verdict]).toMatchObject({
      if: 'always() && !cancelled()',
      env: {
        START_RESULT: '${{ needs.verify-start.result }}',
        SHARD_RESULT: '${{ needs.verify-shards.result }}',
      },
    });
    expect(end.steps[verdict]!['continue-on-error']).toBeUndefined();
    // Only the nightly diagnostic uploads may fail without failing the job
    // (`ci-artifacts.test.ts`).
    expect(
      end.steps.filter(
        (candidate) =>
          candidate['continue-on-error'] &&
          !/^(observability-traces|turbo-summary)-/.test(
            String(candidate.with?.['name'] ?? '')
          )
      )
    ).toHaveLength(0);
    // regression: verify-repeated-mise-cache-stall (1jzx5994v8)
    expect(
      workflow.jobs['verify-shards']!.steps.filter(
        (step) =>
          step.uses === './.github/actions/setup' ||
          step.uses?.startsWith('jdx/mise-action@')
      )
    ).toHaveLength(1);
    expect(
      workflow.jobs['verify-shards']!.steps.find(
        (step) => step.name === 'Transfer raw evidence'
      )?.['continue-on-error']
    ).toBeUndefined();
    expect(
      workflow.jobs['verify-shards']!.steps.find(
        (step) => step.name === 'verify'
      )?.['continue-on-error']
    ).toBeUndefined();
  });
});
