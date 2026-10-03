import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/property';
import {
  type DepotTarget,
  type DepotWorkflow,
  selectWorkflow,
  startWorkflow,
  watchWorkflow,
} from './workflow-depot';

const SHA = '2a2bda778fd0e66af2a74c7e02ecea6fb80c8956';
const TARGET: DepotTarget = {
  repository: 'gamezilla-org/gamezilla',
  org: 'mk7ncjwh4n',
  workflow: 'check.yml',
  branch: 'ci/speed-up-check-workflow',
  sha: SHA,
  automatic: false,
};
function workflow(status = 'running', id = 'native-check'): DepotWorkflow {
  return {
    workflow_id: id,
    run_id: 'native-run',
    workflow_path: 'check.yml',
    name: 'Check',
    head_sha: SHA,
    sha: 'merge',
    status,
    created_at: '2026-10-02T05:06:11Z',
  };
}
function fixture(
  lists: readonly (readonly DepotWorkflow[])[],
  states: readonly string[] = []
) {
  const commands: (readonly string[])[] = [];
  let listIndex = 0;
  let statusIndex = 0;
  let sleeps = 0;
  return {
    commands,
    sleeps: () => sleeps,
    ports: {
      run(command: readonly string[]): string {
        commands.push(command);
        if (command[2] === 'workflow')
          return JSON.stringify(lists[listIndex++] ?? []);
        if (command[2] === 'status')
          return JSON.stringify({
            status: states[statusIndex],
            workflows: [
              {
                workflow_id: 'native-check',
                status: states[statusIndex++],
                jobs: [],
              },
            ],
          });
        return '';
      },
      sleep: async () => {
        sleeps += 1;
      },
      log() {},
      onWorkflow() {},
    },
  };
}

describe('native Check run ownership', () => {
  // regression: check-manual-cancels-required-pr
  test('resumes the cancelled PR verdict without dispatching a competing Check', async () => {
    const f = fixture([[workflow('cancelled')]]);
    expect(await startWorkflow(TARGET, f.ports)).toEqual(workflow('cancelled'));
    expect(f.commands.at(-1)).toEqual([
      'depot',
      'ci',
      'rerun',
      'native-run',
      '--workflow',
      'native-check',
      '--org',
      TARGET.org,
    ]);
    expect(f.commands.some((command) => command[2] === 'run')).toBe(false);
  });

  test('waits for the automatic run of the pushed commit', async () => {
    const f = fixture([[], [workflow()]]);
    expect(
      await startWorkflow({ ...TARGET, automatic: true }, f.ports)
    ).toEqual(workflow());
    expect(f.sleeps()).toBe(1);
    expect(f.commands.every((command) => command[2] === 'workflow')).toBe(true);
  });

  test.each(['finished', 'failed'])(
    'observes the existing %s verdict without rerunning it',
    async (status) => {
      const f = fixture([[workflow(status)]]);
      await startWorkflow(TARGET, f.ports);
      expect(f.commands).toHaveLength(1);
    }
  );

  test('can execute the branch YAML before native triggers merge', async () => {
    const manual = { ...workflow(), head_sha: '', sha: SHA };
    const f = fixture([[], [manual]]);
    await startWorkflow(TARGET, f.ports);
    expect(f.commands[1]).toEqual([
      'depot',
      'ci',
      'run',
      '--org',
      TARGET.org,
      '--repo',
      TARGET.repository,
      '--workflow',
      '.depot/workflows/check.yml',
    ]);
  });

  test('missing automatic evidence fails without competing dispatch', async () => {
    const f = fixture([]);
    await expect(
      startWorkflow({ ...TARGET, automatic: true }, f.ports)
    ).rejects.toThrow('No PR Check run');
    expect(f.sleeps()).toBe(30);
    expect(f.commands.every((command) => command[2] === 'workflow')).toBe(true);
  });

  test('Deploy dispatches main rather than executing a feature branch locally', async () => {
    const w = { ...workflow(), workflow_path: 'deploy.yml', name: 'Deploy' };
    const f = fixture([[], [w]]);
    await startWorkflow(
      { ...TARGET, workflow: 'deploy.yml', branch: 'main' },
      f.ports
    );
    expect(f.commands[1]).toEqual([
      'depot',
      'ci',
      'dispatch',
      '--org',
      TARGET.org,
      '--repo',
      TARGET.repository,
      '--workflow',
      'deploy.yml',
      '--ref',
      'main',
    ]);
  });

  // regression: health-inline-sha-aws-oidc
  test('Health preserves its branch ref for read-only AWS authentication', async () => {
    const target = {
      ...TARGET,
      workflow: 'health.yml',
      branch: 'fix/deployment-workflow',
      sha: 'b378d1f89f00cfdb5a41c08a1c6f5ffc4400526b',
    };
    const w = {
      ...workflow(),
      workflow_path: 'health.yml',
      name: 'Health',
      head_sha: target.sha,
    };
    const f = fixture([[], [w]]);
    await startWorkflow(target, f.ports);
    expect(f.commands[1]).toEqual([
      'depot',
      'ci',
      'dispatch',
      '--org',
      target.org,
      '--repo',
      target.repository,
      '--workflow',
      'health.yml',
      '--ref',
      target.branch,
    ]);
  });
});

test('Health dispatch retains every requested branch', async () => {
  await assertProperty(
    'health-dispatch-branch-ref',
    fc.asyncProperty(
      fc.stringMatching(/^[a-z][a-z0-9-]{0,12}$/),
      async (name) => {
        const branch = `health/${name}`;
        const w = {
          ...workflow(),
          workflow_path: 'health.yml',
          name: 'Health',
        };
        const f = fixture([[], [w]]);
        await startWorkflow(
          { ...TARGET, workflow: 'health.yml', branch },
          f.ports
        );
        const command = f.commands[1]!;
        expect(command[2]).toBe('dispatch');
        expect(command.slice(-2)).toEqual(['--ref', branch]);
      }
    )
  );
});

// regression: check-duplicate-trigger-runners
test('selects the latest exact-commit native workflow regardless of list order', () => {
  assertProperty(
    'native-workflow-selection',
    fc.property(
      fc.array(
        fc.record({
          seconds: fc.integer({ min: 0, max: 100000 }),
          matching: fc.boolean(),
        }),
        { minLength: 1 }
      ),
      (items) => {
        const runs = items.map((item, index) => ({
          ...workflow(),
          workflow_id: String(index),
          head_sha: item.matching ? SHA : 'other',
          created_at: new Date(item.seconds * 1000).toISOString(),
        }));
        const selected = selectWorkflow(runs, 'check.yml', SHA);
        const eligible = items.filter((item) => item.matching);
        expect(selected === undefined).toBe(eligible.length === 0);
        if (selected !== undefined)
          expect(Date.parse(selected.created_at)).toBe(
            Math.max(...eligible.map((item) => item.seconds * 1000))
          );
      }
    )
  );
});

test.each([
  ['finished', 0],
  ['failed', 1],
  ['cancelled', 1],
] as const)('native %s maps to exit %i', async (status, exit) => {
  const f = fixture([], ['running', status]);
  expect(await watchWorkflow(workflow(), TARGET, f.ports)).toBe(exit);
  expect(f.sleeps()).toBe(1);
});

// regression: check-gate-waits-for-publication
test('Check returns its required verdict while publication is still running', async () => {
  const f = fixture([], ['running']);
  const ports = {
    ...f.ports,
    run: () =>
      JSON.stringify({
        workflows: [
          {
            workflow_id: 'native-check',
            status: 'running',
            jobs: [
              { job_id: 'gate', job_display_name: 'check', status: 'finished' },
              {
                job_id: 'reports',
                job_display_name: 'check:reports',
                status: 'running',
              },
            ],
          },
        ],
      }),
  };
  expect(await watchWorkflow(workflow(), TARGET, ports)).toBe(0);
  expect(f.sleeps()).toBe(0);
});
