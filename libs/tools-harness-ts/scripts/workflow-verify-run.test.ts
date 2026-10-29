import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import type { GitHubTarget, GitHubWorkflow } from './workflow-github';
import {
  selectWorkflow,
  startWorkflow,
  watchWorkflow,
} from './workflow-github';

const SHA = '2a2bda778fd0e66af2a74c7e02ecea6fb80c8956';
const TARGET: GitHubTarget = {
  repository: 'acme/repo',
  workflow: 'health.yml',
  branch: 'health/verify-deployment',
  sha: SHA,
  inputs: {},
};

function workflow(conclusion = '', id = 42): GitHubWorkflow {
  return {
    databaseId: id,
    headSha: SHA,
    status: conclusion ? 'completed' : 'in_progress',
    conclusion,
    createdAt: '2026-10-02T05:06:11Z',
    event: 'workflow_dispatch',
    url: `https://github.com/acme/repo/actions/runs/${id}`,
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

describe('GitHub release workflow dispatch', () => {
  test('Release dispatches main rather than executing locally', async () => {
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
