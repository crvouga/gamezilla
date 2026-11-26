import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

function budgetCommand(file: string): string {
  const source = readFileSync(
    join(import.meta.dirname, '../../../.github/workflows', file),
    'utf8'
  );
  const workflow = Bun.YAML.parse(source) as {
    jobs: Record<string, { steps?: { id?: string; run?: string }[] }>;
  };
  const jobs = Object.values(workflow.jobs).filter((job) => job.steps);
  const commands = jobs.map((job) => job.steps?.[0]);
  for (const command of commands) expect(command?.id).toBe('budget');
  return commands[0]?.run ?? '';
}

test('every stage spends one deadline across queues and sequential jobs', () => {
  const command = budgetCommand('verify-pr.yml');
  expect(budgetCommand('deploy.yml')).toBe(command);
  expect(budgetCommand('verify-nightly.yml')).toBe(command);
  const dir = mkdtempSync(join(tmpdir(), 'ci-budget-'));
  try {
    const gh = join(dir, 'gh');
    writeFileSync(gh, '#!/bin/sh\necho "$CREATED"\n', { mode: 0o755 });
    const env = {
      ...process.env,
      PATH: dir + ':' + process.env['PATH'],
      CREATED: '2000-01-01T00:00:00Z',
      STAGE_SECONDS: '180',
      GITHUB_RUN_ID: '1',
      GITHUB_REPOSITORY: 'owner/repo',
      RUNNER_TEMP: dir,
      GITHUB_ENV: join(dir, 'env'),
      GITHUB_PATH: join(dir, 'path'),
      GITHUB_OUTPUT: join(dir, 'output'),
    };
    expect(spawnSync('bash', ['-c', command], { env }).status).toBe(1);
    env.CREATED = '2099-01-01T00:00:00Z';
    expect(spawnSync('bash', ['-c', command], { env }).status).toBe(0);
    expect(readFileSync(env.GITHUB_ENV, 'utf8')).toBe(
      'CI_STAGE_DEADLINE=4070908980\n'
    );
    const shell = join(dir, 'ci-budget/ci-budget-shell');
    const body = join(dir, 'body');
    writeFileSync(body, 'exit 7');
    expect(
      spawnSync(shell, [body], { env: { ...env, CI_STAGE_DEADLINE: '1' } })
        .status
    ).toBe(124);
    expect(
      spawnSync(shell, [body], {
        env: { ...env, CI_STAGE_DEADLINE: '4070908980' },
      }).status
    ).toBe(7);
  } finally {
    removeTree(dir);
  }
});
