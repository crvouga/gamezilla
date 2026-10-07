import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import type { GitHubTarget, GitHubWorkflow } from './workflow-github';
import {
  hasAutomaticCheck,
  selectWorkflow,
  startWorkflow,
  watchWorkflow,
} from './workflow-github';

const SHA = '2a2bda778fd0e66af2a74c7e02ecea6fb80c8956';
const TARGET: GitHubTarget = {
  repository: 'gamezilla-org/gamezilla',
  workflow: 'check.yml',
  branch: 'ci/speed-up-check-workflow',
  sha: SHA,
  automatic: false,
  inputs: {},
};
// regression: github-fork-upstream-check-discovery
test('discovers the PR on the configured repository instead of the CLI default upstream', () => {
  const commands: (readonly string[])[] = [];
  expect(
    hasAutomaticCheck(TARGET, {
      run: (command) => {
        commands.push(command);
        return JSON.stringify([{ headRefOid: SHA }]);
      },
    })
  ).toBe(true);
  expect(commands).toEqual([
    [
      'gh',
      'pr',
      'list',
      '--repo',
      'gamezilla-org/gamezilla',
      '--head',
      TARGET.branch,
      '--base',
      'main',
      '--state',
      'open',
      '--json',
      'headRefOid',
    ],
  ]);
});

function workflow(conclusion = '', id = 42): GitHubWorkflow {
  return {
    databaseId: id,
    headSha: SHA,
    status: conclusion ? 'completed' : 'in_progress',
    conclusion,
    createdAt: '2026-10-02T05:06:11Z',
    event: 'pull_request',
    url: `https://github.com/gamezilla-org/gamezilla/actions/runs/${id}`,
  };
}
function fixture(
  lists: readonly (readonly GitHubWorkflow[])[],
  conclusions: readonly string[] = []
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
        if (command[2] === 'list')
          return JSON.stringify(lists[listIndex++] ?? []);
        if (command[2] === 'view' && command.includes('--json')) {
          const conclusion = conclusions[statusIndex++] ?? '';
          return JSON.stringify({
            status: conclusion ? 'completed' : 'in_progress',
            conclusion,
            jobs: [],
          });
        }
        return '';
      },
      sleep: async () => {
        sleeps++;
      },
      log() {},
      onWorkflow() {},
    },
  };
}

describe('GitHub Check run ownership', () => {
  // regression: check-manual-cancels-required-pr
  test('resumes the cancelled PR verdict without a competing dispatch', async () => {
    const f = fixture([[workflow('cancelled')]]);
    expect(await startWorkflow(TARGET, f.ports)).toEqual(workflow('cancelled'));
    expect(f.commands.at(-1)).toEqual([
      'gh',
      'run',
      'rerun',
      '42',
      '--repo',
      TARGET.repository,
    ]);
    expect(f.commands.some((command) => command[1] === 'workflow')).toBe(false);
  });
  test('waits for the automatic run of the pushed commit', async () => {
    const f = fixture([[], [workflow()]]);
    expect(
      await startWorkflow({ ...TARGET, automatic: true }, f.ports)
    ).toEqual(workflow());
    expect(f.sleeps()).toBe(1);
    expect(f.commands.every((command) => command[2] === 'list')).toBe(true);
  });
  test.each(['success', 'failure'])(
    'observes existing %s without rerunning',
    async (conclusion) => {
      const f = fixture([[workflow(conclusion)]]);
      await startWorkflow(TARGET, f.ports);
      expect(f.commands).toHaveLength(1);
    }
  );
  test('dispatches Check on the requested branch', async () => {
    const f = fixture([[], [workflow()]]);
    await startWorkflow(TARGET, f.ports);
    expect(f.commands[1]).toEqual([
      'gh',
      'workflow',
      'run',
      'check.yml',
      '--repo',
      TARGET.repository,
      '--ref',
      TARGET.branch,
    ]);
  });
  test('full verification dispatches fresh even when the commit already has a run', async () => {
    const f = fixture([
      [workflow('success')],
      [workflow('', 43), workflow('success')],
    ]);
    const started = await startWorkflow(
      { ...TARGET, inputs: { scope: 'full' } },
      f.ports
    );
    expect(started.databaseId).toBe(43);
    expect(f.commands[1]).toEqual([
      'gh',
      'workflow',
      'run',
      'check.yml',
      '--repo',
      TARGET.repository,
      '--ref',
      TARGET.branch,
      '-f',
      'scope=full',
    ]);
  });
  test('missing automatic evidence fails without competing dispatch', async () => {
    const f = fixture([]);
    await expect(
      startWorkflow({ ...TARGET, automatic: true }, f.ports)
    ).rejects.toThrow('No PR Check run');
    expect(f.sleeps()).toBe(30);
    expect(f.commands.every((command) => command[2] === 'list')).toBe(true);
  });
  test('Deploy dispatches main rather than executing locally', async () => {
    const f = fixture([[], [workflow()]]);
    await startWorkflow(
      { ...TARGET, workflow: 'deploy.yml', branch: 'main' },
      f.ports
    );
    expect(f.commands[1]).toEqual([
      'gh',
      'workflow',
      'run',
      'deploy.yml',
      '--repo',
      TARGET.repository,
      '--ref',
      'main',
    ]);
  });
  // regression: health-inline-sha-aws-oidc
  test('Health preserves the named branch for AWS authentication', async () => {
    const f = fixture([[], [workflow()]]);
    await startWorkflow(
      { ...TARGET, workflow: 'health.yml', branch: 'fix/deployment-workflow' },
      f.ports
    );
    expect(f.commands[1]).toEqual([
      'gh',
      'workflow',
      'run',
      'health.yml',
      '--repo',
      TARGET.repository,
      '--ref',
      'fix/deployment-workflow',
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
        const f = fixture([[], [workflow()]]);
        await startWorkflow(
          { ...TARGET, workflow: 'health.yml', branch },
          f.ports
        );
        expect(f.commands[1]?.slice(-2)).toEqual(['--ref', branch]);
      }
    )
  );
});
// regression: check-duplicate-trigger-runners
test('selects the latest exact commit regardless of list order', () => {
  assertProperty(
    'github-workflow-selection',
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
          ...workflow('', index),
          headSha: item.matching ? SHA : 'other',
          createdAt: new Date(item.seconds * 1000).toISOString(),
        }));
        const selected = selectWorkflow(runs, SHA);
        const eligible = items.filter((item) => item.matching);
        expect(selected === undefined).toBe(eligible.length === 0);
        if (selected)
          expect(Date.parse(selected.createdAt)).toBe(
            Math.max(...eligible.map((item) => item.seconds * 1000))
          );
      }
    )
  );
});
test.each([
  ['success', 0],
  ['failure', 1],
  ['cancelled', 1],
] as const)('%s maps to exit %i', async (conclusion, exit) => {
  const f = fixture([], ['', conclusion]);
  expect(await watchWorkflow(workflow(), TARGET, f.ports)).toBe(exit);
  expect(f.sleeps()).toBe(1);
});
// regression: check-gate-waits-for-publication
test.each([
  ['success', 0],
  ['failure', 1],
  ['skipped', 1],
] as const)(
  'Check returns its %s gate while publication runs',
  async (conclusion, exit) => {
    const f = fixture([]);
    const ports = {
      ...f.ports,
      run: () =>
        JSON.stringify({
          status: 'in_progress',
          conclusion: '',
          jobs: [
            { name: 'check', status: 'completed', conclusion },
            { name: 'check:reports', status: 'in_progress', conclusion: '' },
          ],
        }),
    };
    expect(await watchWorkflow(workflow(), TARGET, ports)).toBe(exit);
    expect(f.sleeps()).toBe(0);
  }
);
