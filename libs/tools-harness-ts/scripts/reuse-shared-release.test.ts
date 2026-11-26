// @io-wall-ok — exercise the hosted shell entry with a real Git diff and a fixture gh.
import { expect, test } from 'bun:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

const root = join(import.meta.dir, '../../..');
const script = join(import.meta.dir, 'reuse-shared-release.sh');

function commit(dir: string, paths: readonly string[]) {
  for (const path of paths) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), 'fixture');
  }
  const git = (args: string[]) =>
    execFileSync(
      'git',
      ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args],
      { cwd: dir, encoding: 'utf8' }
    ).trim();
  git(['add', '--', ...paths]);
  git(['commit', '-qm', 'fixture']);
  return git(['rev-parse', 'HEAD']);
}

function historyFixture(dir: string, sha: string) {
  writeFileSync(join(dir, 'date'), '#!/bin/sh\necho 2026-11-26T13:06:21Z\n', {
    mode: 0o755,
  });
  writeFileSync(
    join(dir, 'gh'),
    '#!/bin/sh\ncase "$*" in *attempts*) cat jobs;; *) cat runs;; esac\n',
    { mode: 0o755 }
  );
  const run = {
    id: 45834142135,
    head_sha: sha,
    status: 'completed',
    run_attempt: 1,
    created_at: '2026-11-26T13:57:14Z',
  };
  const runs = (candidate: typeof run) =>
    writeFileSync(
      join(dir, 'runs'),
      JSON.stringify({ total_count: 1, workflow_runs: [candidate] })
    );
  const jobs = (fleet: string, policy: string) =>
    writeFileSync(
      join(dir, 'jobs'),
      JSON.stringify({
        total_count: 2,
        jobs: [
          { name: 'Release shared services', conclusion: fleet },
          { name: 'Enforce repository policy', conclusion: policy },
        ],
      })
    );
  const result = (event = 'push') =>
    spawnSync('bash', [script], {
      cwd: dir,
      env: {
        ...process.env,
        PATH: dir + ':' + process.env['PATH'],
        GITHUB_EVENT_NAME: event,
        GITHUB_REF: 'refs/heads/main',
        GITHUB_RUN_ATTEMPT: '1',
        GITHUB_RUN_ID: '45835649817',
        GITHUB_REPOSITORY: 'owner/repo',
      },
    }).status;
  runs(run);
  return { run, runs, jobs, result };
}

// regression: release-shared-apply-runner-delay
test('Release reuses a completed apply across verification edits and requires fresh proof after any possible mutation', () => {
  const cache = join(root, '.cache');
  mkdirSync(cache, { recursive: true });
  const dir = mkdtempSync(join(cache, 'release-apply-'));
  try {
    execFileSync('git', ['init', '-q', dir]);
    const sha = commit(dir, ['README.md']);
    commit(dir, [
      '.github/workflows/verify-pr.yml',
      'libs/tools-harness-ts/scripts/ci-stage.ts',
      'libs/tools-harness-ts/scripts/reuse-shared-release.sh',
      'docs/CI_REQUIREMENTS.md',
      'libs/tools-harness-ts/scripts/verify-plan-schedule.ts',
      'libs/tools-harness-ts/scripts/verify-plan.ts',
      'libs/tools-harness-ts/scripts/workflow-plan-artifact.test.ts',
    ]);
    const { run, runs, jobs, result } = historyFixture(dir, sha);
    jobs('success', 'success');
    expect(result()).toBe(0);
    expect(result('workflow_dispatch')).not.toBe(0);
    for (const outcome of ['cancelled', 'failure', 'skipped']) {
      jobs('success', outcome);
      expect(result()).not.toBe(0);
    }
    jobs('skipped', 'skipped');
    expect(result()).not.toBe(0);
    jobs('success', 'success');
    runs({ ...run, run_attempt: 2 });
    expect(result()).not.toBe(0);
    runs({ ...run, created_at: '2000-01-01T00:00:00Z' });
    expect(result()).not.toBe(0);
    runs(run);
    commit(dir, ['libs/infra-shared-ts/tofu/stacks/fleet/main.tf']);
    expect(result()).not.toBe(0);
  } finally {
    removeTree(dir);
  }
});
