#!/usr/bin/env bun
// @io-wall-ok — gh CLI entry
/**
 * `bun check`, `bun health`, and `bun deploy`: dispatch the matching
 * workflow on GitHub and block until it finishes. The exit code is the
 * run's verdict. While the watch runs, keystroke echo is off, so a
 * scroll wheel's arrow keys stay out of the transcript. Ctrl-C still
 * cancels (SIGTERM / SIGHUP do too). SIGKILL cannot be caught — cancel
 * that run with `gh run cancel <id>`.
 *
 *   bun check  [--message "type(scope): summary"]  → check.yml on this branch
 *   bun health [--message "type(scope): summary"]  → health.yml on this branch
 *   bun deploy                                     → deploy.yml on main
 *
 * Check and health run `/git-sync` first, so the run checks out this
 * HEAD, current with trunk. Check refuses on `main`. Deploy does not
 * commit: it fast-forwards local `main` and dispatches `origin/main`,
 * the only ref that workflow accepts.
 *
 * Workflow jobs run the local runners (`turbo-ci-run`, `bun health:local`,
 * `bun deploy:local`), never these commands, which would dispatch again.
 * Check also prints the spec report address once the branch is synced:
 * `https://<dev apex>/reports/<sha>`.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  type GitSyncOptions,
  gitSync,
  parseGitSyncArgs,
  SyncError,
} from './git-sync';

const DEV_ENV_FILE = join(
  import.meta.dirname,
  '../../infra/tofu/envs/dev.tfvars.json'
);
const FIND_RUN_ATTEMPTS = 30;
const FIND_RUN_INTERVAL_MS = 2000;
const FAILED_LOG_LINES = 200;
const TRUNK = 'main';

export type RemoteCommand = 'check' | 'health' | 'deploy';

/** How one laptop command maps onto its workflow. */
export type WorkflowDispatch = {
  readonly workflow: string;
  /** `branch` git-syncs the checkout; `trunk` only fast-forwards main. */
  readonly sync: 'branch' | 'trunk';
  readonly refuseOnMain: boolean;
  readonly printsReport: boolean;
};

export const WORKFLOW_DISPATCH: Record<RemoteCommand, WorkflowDispatch> = {
  check: {
    workflow: 'check.yml',
    sync: 'branch',
    refuseOnMain: true,
    printsReport: true,
  },
  health: {
    workflow: 'health.yml',
    sync: 'branch',
    refuseOnMain: false,
    printsReport: false,
  },
  deploy: {
    workflow: 'deploy.yml',
    sync: 'trunk',
    refuseOnMain: false,
    printsReport: false,
  },
};

export function isRemoteCommand(value: string): value is RemoteCommand {
  return Object.hasOwn(WORKFLOW_DISPATCH, value);
}

class WorkflowRemoteError extends Error {}

type Stty = {
  readonly code: number;
  readonly out: string;
  readonly err: string;
};

function stty(args: readonly string[]): Stty {
  const result = Bun.spawnSync(['stty', ...args], {
    stdin: 'inherit',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    code: result.exitCode ?? 1,
    out: result.stdout.toString().trim(),
    err: result.stderr.toString().trim(),
  };
}

function sttyOk(args: readonly string[]): string {
  const result = stty(args);
  if (result.code !== 0) {
    throw new WorkflowRemoteError(
      `stty ${args.join(' ')} failed: ${result.err || result.out}`
    );
  }
  return result.out;
}

const discardTTYInput = (): void => {};

export type TtyHold = {
  release(): void;
};

/**
 * A scroll wheel delivers arrow keys (`^[[B` down, `^[[A` up). While a
 * watch is the foreground job those keys are echoed into the transcript
 * unless echo is off. `isig` stays on, so Ctrl-C is still a signal.
 * `release` puts the previous settings back.
 */
export function holdTTY(): TtyHold {
  if (process.stdin.isTTY !== true) return { release() {} };
  const saved = sttyOk(['-g']);
  sttyOk(['-echo', '-icanon']);
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    process.stdin.off('data', discardTTYInput);
    process.stdin.pause();
    if (stty([saved]).code !== 0) stty(['sane']);
  };
  try {
    process.stdin.on('data', discardTTYInput);
    process.stdin.resume();
  } catch (error) {
    release();
    throw error;
  }
  return { release };
}

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
    throw new WorkflowRemoteError(
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

function listDispatchRuns(workflow: string, branch: string): ListedRun[] {
  const out = must([
    'gh',
    'run',
    'list',
    '--workflow',
    workflow,
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

type PreparedRun = {
  readonly branch: string;
  readonly sha: string;
};

/** Deploy ships `origin/main`. A message would commit the feature branch. */
function prepareTrunk(options: GitSyncOptions): PreparedRun {
  if (options.message !== null || options.leaveConflicts) {
    throw new WorkflowRemoteError(
      'deploy ships origin/main and does not commit or merge.'
    );
  }
  gitSync({ message: null, trunkOnly: true, leaveConflicts: false });
  return {
    branch: TRUNK,
    sha: must(['git', 'rev-parse', 'origin/main']),
  };
}

/** Check and health run on the synced checkout. */
function prepareBranch(
  target: WorkflowDispatch,
  options: GitSyncOptions
): PreparedRun {
  if (options.trunkOnly) {
    throw new WorkflowRemoteError('--trunk-only is not a workflow run.');
  }
  const current = must(['git', 'branch', '--show-current']);
  if (target.refuseOnMain && current === TRUNK) {
    throw new WorkflowRemoteError(
      'refusing to run on main: use a feature branch.'
    );
  }
  const branch = gitSync(options);
  return { branch, sha: must(['git', 'rev-parse', 'HEAD']) };
}

function prepareRun(
  target: WorkflowDispatch,
  argv: readonly string[]
): PreparedRun {
  const options = parseGitSyncArgs(argv);
  return target.sync === 'trunk'
    ? prepareTrunk(options)
    : prepareBranch(target, options);
}

async function waitForRun(
  workflow: string,
  branch: string,
  sha: string,
  knownIds: ReadonlySet<number>
): Promise<number> {
  for (let attempt = 0; attempt < FIND_RUN_ATTEMPTS; attempt += 1) {
    const found = findNewRun(listDispatchRuns(workflow, branch), knownIds, sha);
    if (found !== undefined) return found.databaseId;
    await Bun.sleep(FIND_RUN_INTERVAL_MS);
  }
  throw new WorkflowRemoteError(
    `dispatched ${workflow} but no run for ${sha.slice(0, 9)} appeared; see ` +
      `\`gh run list --workflow ${workflow} --branch ${branch}\`.`
  );
}

function cancelRun(label: string, runId: number): void {
  console.error(`\n${label}: cancelling run ${String(runId)} on GitHub…`);
  const result = run(['gh', 'run', 'cancel', String(runId)]);
  console.error(
    result.code === 0
      ? `${label}: cancelled.`
      : `${label}: cancel failed: ${result.err || result.out}`
  );
}

type WatchState = {
  readonly label: string;
  runId: number | null;
  watcher: ChildProcess | null;
  tty: TtyHold | null;
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
    state.tty?.release();
    state.watcher?.kill('SIGTERM');
    const runId = state.runId ?? state.lookup();
    if (runId !== null) cancelRun(state.label, runId);
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, onSignal);
  }
}

function printFailedLog(label: string, runId: number): void {
  const result = run(['gh', 'run', 'view', String(runId), '--log-failed']);
  const lines = result.out.split('\n');
  console.error(
    `\n${label}: last ${String(Math.min(lines.length, FAILED_LOG_LINES))} failed-step log lines:`
  );
  console.error(lines.slice(-FAILED_LOG_LINES).join('\n'));
}

type RunWorkflowOptions = {
  readonly workflow: string;
  /** Log prefix, e.g. `check`. */
  readonly label: string;
  readonly branch: string;
  readonly sha: string;
};

/**
 * Dispatch `workflow` on `branch`, block until its run finishes and return the
 * run's exit code and URL. Ctrl-C / SIGTERM / SIGHUP cancel the run first.
 */
async function runWorkflow(
  options: RunWorkflowOptions
): Promise<{ readonly code: number; readonly url: string }> {
  const { workflow, label, branch, sha } = options;
  const knownIds = new Set(
    listDispatchRuns(workflow, branch).map((listed) => listed.databaseId)
  );
  const state: WatchState = {
    label,
    runId: null,
    watcher: null,
    tty: null,
    lookup: () =>
      findNewRun(listDispatchRuns(workflow, branch), knownIds, sha)
        ?.databaseId ?? null,
  };
  cancelOnSignals(state);

  must(['gh', 'workflow', 'run', workflow, '--ref', branch]);
  console.log(
    `${label}: dispatched ${workflow} on ${branch} @ ${sha.slice(0, 9)}`
  );
  state.runId = await waitForRun(workflow, branch, sha, knownIds);
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
  console.log(`${label}: ${url}`);

  // Own process group: the terminal's Ctrl-C reaches only this script, which
  // cancels the run before the watcher goes away. stdin stays here so a
  // scroll's arrow keys can be discarded instead of echoed.
  state.tty = holdTTY();
  try {
    const watcher = spawn(
      'gh',
      ['run', 'watch', String(state.runId), '--exit-status', '--interval', '3'],
      { stdio: ['ignore', 'inherit', 'inherit'], detached: true }
    );
    state.watcher = watcher;
    const code = await new Promise<number>((resolve) => {
      watcher.on('close', (exitCode) => resolve(exitCode ?? 1));
    });
    if (code !== 0) printFailedLog(label, state.runId);
    console.log(`${label}: ${code === 0 ? 'passed' : 'failed'} — ${url}`);
    return { code, url };
  } finally {
    state.tty.release();
  }
}

/** Where the commit's spec report is read: the dev deployment's reports screen. */
function reportUrl(sha: string): string {
  const env = JSON.parse(readFileSync(DEV_ENV_FILE, 'utf8')) as {
    readonly hosts: { readonly apex: string };
  };
  return `https://${env.hosts.apex}/reports/${sha}`;
}

async function runCommand(argv: readonly string[]): Promise<number> {
  const command = argv[0] ?? '';
  if (!isRemoteCommand(command)) {
    throw new WorkflowRemoteError(
      'usage: workflow-remote.ts <check|health|deploy> [--message "type(scope): summary"]'
    );
  }
  const target = WORKFLOW_DISPATCH[command];
  const { branch, sha } = prepareRun(target, argv.slice(1));
  if (target.printsReport) {
    console.log(`${command}: spec report ${reportUrl(sha)}`);
  }
  const { code } = await runWorkflow({
    workflow: target.workflow,
    label: command,
    branch,
    sha,
  });
  return code;
}

if (import.meta.main) {
  const command = process.argv[2] ?? '';
  const label = isRemoteCommand(command) ? command : 'workflow';
  try {
    process.exit(await runCommand(process.argv.slice(2)));
  } catch (error) {
    if (!(error instanceof WorkflowRemoteError || error instanceof SyncError)) {
      throw error;
    }
    console.error(`${label}: ${error.message}`);
    process.exit(1);
  }
}
