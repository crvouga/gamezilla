#!/usr/bin/env bun
// @io-wall-ok — gh CLI entry
/**
 * `bun pr`: run `.github/workflows/pr.yml` on GitHub for the current branch
 * and block until it finishes. The exit code is the run's verdict. Ctrl-C /
 * SIGTERM / SIGHUP cancel the run on GitHub before exiting (SIGKILL cannot be
 * caught — cancel that run with `gh run cancel <id>`).
 *
 * First it syncs the branch with GitHub: merges commits only `origin/<branch>`
 * has (aborting on conflict), then pushes, so the run checks out the local
 * HEAD. Uncommitted changes are not part of the run. Refuses on `main`.
 */

import { type ChildProcess, spawn } from 'node:child_process';

const WORKFLOW = 'pr.yml';
const FIND_RUN_ATTEMPTS = 30;
const FIND_RUN_INTERVAL_MS = 2000;
const FAILED_LOG_LINES = 200;

class PrRunError extends Error {}

type Run = {
  readonly code: number;
  readonly out: string;
  readonly err: string;
};

function run(cmd: readonly string[]): Run {
  const result = Bun.spawnSync([...cmd], { stdout: 'pipe', stderr: 'pipe' });
  return {
    code: result.exitCode ?? 1,
    out: result.stdout.toString().trim(),
    err: result.stderr.toString().trim(),
  };
}

function must(cmd: readonly string[]): string {
  const result = run(cmd);
  if (result.code !== 0) {
    throw new PrRunError(
      `${cmd.join(' ')} failed: ${result.err || result.out}`
    );
  }
  return result.out;
}

export type ListedRun = {
  readonly databaseId: number;
  readonly headSha: string;
};

/** The run our dispatch created: new since the snapshot, on our commit. */
export function findNewRun(
  runs: readonly ListedRun[],
  knownIds: ReadonlySet<number>,
  sha: string
): ListedRun | undefined {
  return runs.find(
    (candidate) =>
      !knownIds.has(candidate.databaseId) && candidate.headSha === sha
  );
}

function listDispatchRuns(branch: string): ListedRun[] {
  const out = must([
    'gh',
    'run',
    'list',
    '--workflow',
    WORKFLOW,
    '--branch',
    branch,
    '--event',
    'workflow_dispatch',
    '--limit',
    '20',
    '--json',
    'databaseId,headSha',
  ]);
  return JSON.parse(out) as ListedRun[];
}

const TRUNKS: ReadonlySet<string> = new Set(['main', 'master']);

function remoteBranchExists(branch: string): boolean {
  return run(['git', 'fetch', '--quiet', 'origin', branch]).code === 0;
}

/** Merge commits that exist only on `origin/<branch>` into the local branch. */
function pullRemote(branch: string): void {
  const upToDate = run([
    'git',
    'merge-base',
    '--is-ancestor',
    `origin/${branch}`,
    'HEAD',
  ]);
  if (upToDate.code === 0) return;
  console.log(`pr: merging origin/${branch} into ${branch}`);
  const merged = run(['git', 'merge', '--no-edit', `origin/${branch}`]);
  if (merged.code !== 0) {
    run(['git', 'merge', '--abort']);
    throw new PrRunError(
      `merging origin/${branch} failed (aborted): ${merged.err || merged.out}`
    );
  }
}

/**
 * Sync the branch with GitHub — pull what only origin has, push what only
 * this clone has — so the run checks out exactly the local HEAD.
 */
function syncBranch(): { readonly branch: string; readonly sha: string } {
  const branch = must(['git', 'branch', '--show-current']);
  if (branch === '') throw new PrRunError('detached HEAD: check out a branch.');
  if (TRUNKS.has(branch)) {
    throw new PrRunError(
      `refusing to push ${branch}: run from a feature branch.`
    );
  }
  if (must(['git', 'status', '--porcelain']) !== '') {
    console.warn(
      'pr: uncommitted changes are not part of this run — commit them first.'
    );
  }
  if (remoteBranchExists(branch)) pullRemote(branch);
  const pushed = Bun.spawnSync(['git', 'push', '-u', 'origin', branch], {
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  if (pushed.exitCode !== 0)
    throw new PrRunError(`git push origin ${branch} failed.`);
  return { branch, sha: must(['git', 'rev-parse', 'HEAD']) };
}

async function waitForRun(
  branch: string,
  sha: string,
  knownIds: ReadonlySet<number>
): Promise<number> {
  for (let attempt = 0; attempt < FIND_RUN_ATTEMPTS; attempt += 1) {
    const found = findNewRun(listDispatchRuns(branch), knownIds, sha);
    if (found !== undefined) return found.databaseId;
    await Bun.sleep(FIND_RUN_INTERVAL_MS);
  }
  throw new PrRunError(
    `dispatched ${WORKFLOW} but no run for ${sha.slice(0, 9)} appeared; see ` +
      `\`gh run list --workflow ${WORKFLOW} --branch ${branch}\`.`
  );
}

function cancelRun(runId: number): void {
  console.error(`\npr: cancelling run ${String(runId)} on GitHub…`);
  const result = run(['gh', 'run', 'cancel', String(runId)]);
  console.error(
    result.code === 0
      ? 'pr: cancelled.'
      : `pr: cancel failed: ${result.err || result.out}`
  );
}

type WatchState = {
  runId: number | null;
  watcher: ChildProcess | null;
  readonly lookup: () => number | null;
};

/**
 * Cancel on interrupt. Before the run id is known, look it up once so a
 * Ctrl-C during dispatch still cancels what was started.
 */
function cancelOnSignals(state: WatchState): void {
  let handled = false;
  const onSignal = (signal: NodeJS.Signals) => {
    if (handled) return;
    handled = true;
    state.watcher?.kill('SIGTERM');
    const runId = state.runId ?? state.lookup();
    if (runId !== null) cancelRun(runId);
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, onSignal);
  }
}

function printFailedLog(runId: number): void {
  const result = run(['gh', 'run', 'view', String(runId), '--log-failed']);
  const lines = result.out.split('\n');
  console.error(
    `\npr: last ${String(Math.min(lines.length, FAILED_LOG_LINES))} failed-step log lines:`
  );
  console.error(lines.slice(-FAILED_LOG_LINES).join('\n'));
}

async function main(): Promise<number> {
  const { branch, sha } = syncBranch();
  const knownIds = new Set(listDispatchRuns(branch).map((r) => r.databaseId));
  const state: WatchState = {
    runId: null,
    watcher: null,
    lookup: () =>
      findNewRun(listDispatchRuns(branch), knownIds, sha)?.databaseId ?? null,
  };
  cancelOnSignals(state);

  must(['gh', 'workflow', 'run', WORKFLOW, '--ref', branch]);
  console.log(`pr: dispatched ${WORKFLOW} on ${branch} @ ${sha.slice(0, 9)}`);
  state.runId = await waitForRun(branch, sha, knownIds);
  const url = must([
    'gh',
    'run',
    'view',
    String(state.runId),
    '--json',
    'url',
    '--jq',
    '.url',
  ]);
  console.log(`pr: ${url}`);

  // Own process group: the terminal's Ctrl-C reaches only this script, which
  // cancels the run before the watcher goes away.
  const watcher = spawn(
    'gh',
    ['run', 'watch', String(state.runId), '--exit-status', '--interval', '3'],
    { stdio: 'inherit', detached: true }
  );
  state.watcher = watcher;
  const code = await new Promise<number>((resolve) => {
    watcher.on('close', (exitCode) => resolve(exitCode ?? 1));
  });
  if (code !== 0) printFailedLog(state.runId);
  console.log(`pr: ${code === 0 ? 'passed' : 'failed'} — ${url}`);
  return code;
}

if (import.meta.main) {
  try {
    process.exit(await main());
  } catch (error) {
    if (!(error instanceof PrRunError)) throw error;
    console.error(`pr: ${error.message}`);
    process.exit(1);
  }
}
