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
    '#!/bin/sh\ncase "$*" in */45903734711/attempts/*) cat cancelled-jobs;; *attempts*) cat jobs;; *) cat runs;; esac\n',
    { mode: 0o755 }
  );
  const run = {
    id: 45834142135,
    head_sha: sha,
    status: 'completed',
    run_attempt: 1,
    created_at: '2026-11-26T13:57:14Z',
  };
  const runs = (...candidates: (typeof run)[]) =>
    writeFileSync(
      join(dir, 'runs'),
      JSON.stringify({
        total_count: candidates.length,
        workflow_runs: candidates,
      })
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
    const sha = commit(dir, ['package.json']);
    commit(dir, [
      // regression: release-reapplies-shared-for-nightly-and-board
      'README.md',
      '.github/workflows/verify-nightly.yml',
      'apps/product-ts/scripts/discover.ts',
      'apps/product-ts/scripts/test-fuzz.ts',
      'apps/product-ts/scripts/test-file-command.test.ts',
      'apps/product-ts/turbo.json',
      'pkgs/hearts-board-client-ts/src/board.css',
      'pkgs/ui-root-client-ts/src/game-session-layout/fixed-stage.module.css',
      'pkgs/ui-root-harness-ts/tests/storybook/desktop-table-room/integration.checks.ts',
      '.github/workflows/verify-pr.yml',
      'libs/tools-harness-ts/scripts/ci-stage.ts',
      'libs/tools-harness-ts/scripts/reuse-shared-release.sh',
      'docs/CI_REQUIREMENTS.md',
      'libs/tools-harness-ts/scripts/verify-plan-schedule.ts',
      'libs/tools-harness-ts/scripts/verify-plan.ts',
      'libs/tools-harness-ts/scripts/workflow-plan-artifact.test.ts',
    ]);
    // regression: release-reapplies-shared-after-ui-and-journey-edits
    commit(dir, [
      'pkgs/ui-root-client-ts/src/file-picker/index.tsx',
      'pkgs/ui-root-client-ts/src/file-picker/file-picker.stories.tsx',
      'pkgs/ui-root-client-ts/tests/file-choice.test.tsx',
      'libs/game-puzzle-client-ts/tests/content-published-page.test.ts',
      'libs/tools-harness-ts/scripts/verify-nightly-verdict.ts',
      'libs/runtime-harness-ts/src/pong-journey-court.ts',
      'libs/runtime-harness-ts/src/pong-journey.ts',
    ]);
    const { run, runs, jobs, result } = historyFixture(dir, sha);
    jobs('success', 'success');
    expect(result()).toBe(0);
    const cancelled = { ...run, id: 45903734711, conclusion: 'cancelled' };
    runs(run, cancelled);
    writeFileSync(join(dir, 'cancelled-jobs'), '{"total_count":0,"jobs":[]}');
    expect(result()).toBe(0);
    writeFileSync(join(dir, 'cancelled-jobs'), '{"total_count":1,"jobs":[]}');
    expect(result()).not.toBe(0);
    runs(run);
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
