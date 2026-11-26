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
  const jobs = Object.entries(workflow.jobs)
    .filter(([id, job]) => id !== 'verify-nightly-admission' && job.steps)
    .map(([, job]) => job);
  const commands = jobs.map((job) => job.steps?.[0]);
  for (const command of commands) expect(command?.id).toBe('budget');
  return commands[0]?.run ?? '';
}

test('every stage spends one deadline across queues and sequential jobs', () => {
  const command = budgetCommand('verify-pr.yml');
  const tail = (shell: string) => shell.slice(shell.indexOf('created_epoch='));
  expect(tail(budgetCommand('verify-full.yml'))).toBe(tail(command));
  expect(budgetCommand('deploy.yml')).toBe(command);
  expect(budgetCommand('health.yml')).toBe(command);
  const nightly = budgetCommand('verify-nightly.yml');
  expect(tail(nightly)).toBe(tail(command));
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
      GITHUB_STEP_SUMMARY: join(dir, 'summary'),
    };
    expect(spawnSync('bash', ['-c', command], { env }).status).toBe(1);
    expect(readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8')).toMatch(
      /Verification incomplete at job admission: \d+s elapsed since workflow creation \(budget: 180s\)/
    );
    // regression: workflow-admission-metadata-timeout
    writeFileSync(
      gh,
      '#!/bin/sh\nif mkdir "$RUNNER_TEMP/first" 2>/dev/null; then exit 124; fi\necho "$CREATED"\n'
    );
    env.CREATED = '2099-01-01T00:00:00Z';
    expect(spawnSync('bash', ['-c', command], { env }).status).toBe(0);
    expect(readFileSync(env.GITHUB_ENV, 'utf8')).toBe(
      'CI_STAGE_DEADLINE=4070908980\n'
    );
    expect(readFileSync(env.GITHUB_OUTPUT, 'utf8').split('\n')).toContain(
      'utc_day=47117'
    );
    // regression: nightly-matrix-admission-metadata-timeout
    writeFileSync(gh, '#!/bin/sh\nexit 124\n');
    for (const cmd of [nightly, budgetCommand('verify-full.yml')]) {
      const shared = { ...env, SHARED_CREATED_AT: env.CREATED };
      expect(spawnSync('bash', ['-c', cmd], { env: shared }).status).toBe(0);
      shared.SHARED_CREATED_AT = '2000-01-01T00:00:00Z';
      expect(spawnSync('bash', ['-c', cmd], { env: shared }).status).toBe(1);
    }
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

test('nightly admission reserves cancellation time after a stalled gate shard', () => {
  // regression: nightly-cancellation-overruns-ceiling
  const dir = mkdtempSync(join(tmpdir(), 'nightly-cutoff-'));
  try {
    const created = '2026-11-26T19:20:20Z';
    const epoch = Date.parse(created) / 1000;
    const env = {
      ...process.env,
      PATH: dir + ':' + process.env['PATH'],
      SHARED_CREATED_AT: created,
      GITHUB_STEP_SUMMARY: join(dir, 'summary'),
    };
    writeFileSync(
      join(dir, 'date'),
      `#!/bin/sh\nif [ "$1" = "-d" ]; then echo ${epoch}; else echo ${epoch + 39 * 60}; fi\n`,
      { mode: 0o755 }
    );
    for (const file of ['verify-nightly.yml', 'verify-full.yml']) {
      const source = readFileSync(
        join(import.meta.dirname, '../../../.github/workflows', file),
        'utf8'
      );
      const seconds = source.match(
        /STAGE_SECONDS: ['"](?:\$\{\{ inputs.profile == 'nightly' && )?(\d+)/
      )?.[1];
      expect(Number(seconds)).toBe(39 * 60);
      const result = spawnSync('bash', ['-c', budgetCommand(file)], {
        env: { ...env, STAGE_SECONDS: seconds },
      });
      expect(result.status).toBe(1);
      expect(result.stdout.toString()).toContain(
        '2340s elapsed since workflow creation'
      );
    }
  } finally {
    removeTree(dir);
  }
});
