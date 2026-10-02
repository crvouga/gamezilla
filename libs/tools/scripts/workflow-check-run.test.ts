import { describe, expect, test } from 'bun:test';

import { CheckRunError, pullRequestCheckRun } from './workflow-check-run';

const BRANCH = 'test/auto-indexing-safety-spec';
const SHA = '2a2bda778fd0e66af2a74c7e02ecea6fb80c8956';
const RUN_ID = 36959395506;

function fixture(prs: unknown, runLists: readonly unknown[]) {
  const commands: (readonly string[])[] = [];
  let listIndex = 0;
  let sleeps = 0;
  return {
    commands,
    sleeps: () => sleeps,
    ports: {
      run(command: readonly string[]): string {
        commands.push(command);
        if (command[1] === 'pr') return JSON.stringify(prs);
        if (command[2] === 'rerun') return '';
        if (command[2] === 'list') {
          expect(command).toContain('pull_request');
          return JSON.stringify(runLists[listIndex++] ?? []);
        }
        throw new Error(`Unexpected command: ${command.join(' ')}`);
      },
      sleep: async () => {
        sleeps += 1;
      },
    },
  };
}

describe('pullRequestCheckRun', () => {
  // regression: check-manual-cancels-required-pr
  test('resumes PR #107 cancelled by the manual Check of the same commit', async () => {
    const f = fixture(
      [{ headRefOid: SHA }],
      [[{ databaseId: RUN_ID, headSha: SHA, conclusion: 'cancelled' }]]
    );
    expect(await pullRequestCheckRun(BRANCH, SHA, f.ports)).toBe(RUN_ID);
    expect(f.commands.at(-1)).toEqual(['gh', 'run', 'rerun', String(RUN_ID)]);
    expect(f.commands.some((command) => command[1] === 'workflow')).toBe(false);
  });

  test('waits for the pushed commit instead of dispatching a competing run', async () => {
    const f = fixture(
      [{ headRefOid: SHA }],
      [
        [{ databaseId: 1, headSha: 'old', conclusion: 'success' }],
        [{ databaseId: RUN_ID, headSha: SHA, conclusion: null }],
      ]
    );
    expect(await pullRequestCheckRun(BRANCH, SHA, f.ports)).toBe(RUN_ID);
    expect(f.sleeps()).toBe(1);
    expect(f.commands.every((command) => command[2] === 'list')).toBe(true);
  });

  test.each(['success', 'failure'])(
    'observes an existing %s verdict without rerunning it',
    async (conclusion) => {
      const f = fixture(
        [{ headRefOid: SHA }],
        [
          [
            { databaseId: RUN_ID, headSha: SHA, conclusion },
            { databaseId: RUN_ID - 1, headSha: SHA, conclusion: 'cancelled' },
          ],
        ]
      );
      expect(await pullRequestCheckRun(BRANCH, SHA, f.ports)).toBe(RUN_ID);
      expect(f.commands).toHaveLength(2);
    }
  );

  test.each([{ prs: [] }, { prs: [{ headRefOid: 'other' }] }])(
    'allows dispatch when no matching open PR exists: %j',
    async ({ prs }) => {
      const f = fixture(prs, []);
      expect(await pullRequestCheckRun(BRANCH, SHA, f.ports)).toBeNull();
      expect(f.commands).toHaveLength(1);
    }
  );

  test('reports a missing automatic run without dispatching over the PR', async () => {
    const f = fixture([{ headRefOid: SHA }], []);
    await expect(
      pullRequestCheckRun(BRANCH, SHA, f.ports)
    ).rejects.toBeInstanceOf(CheckRunError);
    expect(f.sleeps()).toBe(30);
    expect(f.commands.every((command) => command[2] === 'list')).toBe(true);
  });
});
