#!/usr/bin/env bun
// @io-wall-ok — gh CLI entry
/**
 * `bun check`: run the Check workflow (`.github/workflows/check.yml`) on
 * GitHub for the current branch and block until it finishes, so the gate
 * spends GitHub's runners, not this machine. The exit code is the run's
 * verdict. `bun check:local` runs the same gate on this machine instead. Ctrl-C / SIGTERM / SIGHUP cancel the run on GitHub
 * before exiting (SIGKILL cannot be caught — cancel that run with
 * `gh run cancel <id>`).
 *
 *   bun check [--message "type(scope): description"]
 *
 * First it runs `/git-sync` (`git-sync.ts`): commits a dirty tree with
 * `--message`, merges `origin/<branch>` and the latest `origin/main`
 * (aborting on conflict), pushes, and fast-forwards local `main` — so the run
 * checks out the local HEAD, current with trunk. Refuses on `main`.
 */

import { type ChildProcess, spawn } from 'node:child_process';

import { gitSync, parseGitSyncArgs, SyncError } from './git-sync';

const WORKFLOW = 'check.yml';
const FIND_RUN_ATTEMPTS = 30;
const FIND_RUN_INTERVAL_MS = 2000;
const FAILED_LOG_LINES = 200;

class CheckRemoteError extends Error {}

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
    throw new CheckRemoteError(
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

/** `/git-sync` the branch so the run checks out exactly the local HEAD. */
function syncBranch(argv: readonly string[]): {
  readonly branch: string;
  readonly sha: string;
} {
  const options = parseGitSyncArgs(argv);
  if (options.trunkOnly)
    throw new CheckRemoteError('--trunk-only is not a Check run.');
  if (must(['git', 'branch', '--show-current']) === 'main') {
    throw new CheckRemoteError(
      'refusing to run on main: use a feature branch.'
    );
  }
  const branch = gitSync(options);
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
  throw new CheckRemoteError(
    `dispatched ${WORKFLOW} but no run for ${sha.slice(0, 9)} appeared; see ` +
      `\`gh run list --workflow ${WORKFLOW} --branch ${branch}\`.`
  );
}

function cancelRun(runId: number): void {
  console.error(`\ncheck: cancelling run ${String(runId)} on GitHub…`);
  const result = run(['gh', 'run', 'cancel', String(runId)]);
  console.error(
    result.code === 0
      ? 'check: cancelled.'
      : `check: cancel failed: ${result.err || result.out}`
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
    `\ncheck: last ${String(Math.min(lines.length, FAILED_LOG_LINES))} failed-step log lines:`
  );
  console.error(lines.slice(-FAILED_LOG_LINES).join('\n'));
}

async function main(): Promise<number> {
  const { branch, sha } = syncBranch(process.argv.slice(2));
  const knownIds = new Set(listDispatchRuns(branch).map((r) => r.databaseId));
  const state: WatchState = {
    runId: null,
    watcher: null,
    lookup: () =>
      findNewRun(listDispatchRuns(branch), knownIds, sha)?.databaseId ?? null,
  };
  cancelOnSignals(state);

  must(['gh', 'workflow', 'run', WORKFLOW, '--ref', branch]);
  console.log(
    `check: dispatched ${WORKFLOW} on ${branch} @ ${sha.slice(0, 9)}`
  );
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
  console.log(`check: ${url}`);

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
  console.log(`check: ${code === 0 ? 'passed' : 'failed'} — ${url}`);
  return code;
}

if (import.meta.main) {
  try {
    process.exit(await main());
  } catch (error) {
    if (!(error instanceof CheckRemoteError || error instanceof SyncError)) {
      throw error;
    }
    console.error(`check: ${error.message}`);
    process.exit(1);
  }
}
