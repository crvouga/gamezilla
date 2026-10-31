#!/usr/bin/env bun
// @io-wall-ok — GitHub Actions CLI and git composition root.
/** `bun health` and `bun deploy`: sync, run on GitHub Actions, await verdict. */
import { PRODUCT } from '@libs/product-identity-shared-ts/product-identity';
import type { GitSyncOptions } from './git-sync';
import { gitSync, parseGitSyncArgs } from './git-sync';
import type { GitHubTarget, GitHubWorkflow } from './workflow-github';
import {
  listWorkflows,
  selectWorkflow,
  startWorkflow,
  watchWorkflow,
} from './workflow-github';

const TRUNK = 'main';

export type RemoteCommand = 'health' | 'deploy';

/** How one laptop command maps onto its workflow. */
export type WorkflowDispatch = {
  readonly workflow: string;
  /** `branch` git-syncs the checkout; `trunk` only fast-forwards main. */
  readonly sync: 'branch' | 'trunk';
  readonly inputs: Readonly<Record<string, string>>;
};

export const WORKFLOW_DISPATCH: Record<RemoteCommand, WorkflowDispatch> = {
  health: {
    workflow: 'health.yml',
    sync: 'branch',
    inputs: {},
  },
  deploy: {
    workflow: 'deploy.yml',
    sync: 'trunk',
    inputs: {},
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

type PreparedRun = {
  readonly branch: string;
  readonly sha: string;
};

/** Release ships `origin/main`. A message would commit the feature branch. */
function prepareTrunk(options: GitSyncOptions): PreparedRun {
  if (options.message !== null || options.leaveConflicts) {
    throw new WorkflowRemoteError(
      'Release ships origin/main and does not commit or merge.'
    );
  }
  gitSync({ message: null, trunkOnly: true, leaveConflicts: false });
  return {
    branch: TRUNK,
    sha: must(['git', 'rev-parse', 'origin/main']),
  };
}

/** Health runs on the synced checkout. */
function prepareBranch(options: GitSyncOptions): PreparedRun {
  if (options.trunkOnly) {
    throw new WorkflowRemoteError('--trunk-only is not a workflow run.');
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
    : prepareBranch(options);
}

async function runCommand(argv: readonly string[]): Promise<number> {
  const command = argv[0] ?? '';
  if (!isRemoteCommand(command))
    throw new WorkflowRemoteError(
      'usage: workflow-remote.ts <health|deploy> [--message "type(scope): summary"]'
    );
  const policy = WORKFLOW_DISPATCH[command];
  const { branch, sha } = prepareRun(policy, argv.slice(1));
  // The repository the workflows run in (product identity, `external`).
  const target: GitHubTarget = {
    repository: PRODUCT.external.sourceRepository,
    workflow: policy.workflow,
    branch,
    sha,
    inputs: policy.inputs,
  };
  const hold = holdTTY();
  let current: GitHubWorkflow | undefined;
  const ports = {
    run: must,
    sleep: Bun.sleep,
    log: (message: string) => console.log(`${command}: ${message}`),
    onWorkflow: (workflow: GitHubWorkflow) => {
      current = workflow;
    },
  };
  let interrupted = false;
  const stop = (signal: NodeJS.Signals) => {
    if (interrupted) return;
    interrupted = true;
    hold.release();
    const workflow =
      current ?? selectWorkflow(listWorkflows(target, ports), target.sha);
    if (workflow !== undefined)
      run([
        'gh',
        'run',
        'cancel',
        String(workflow.databaseId),
        '--repo',
        target.repository,
      ]);
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)
    process.once(signal, stop);
  try {
    current = await startWorkflow(target, ports);
    const url = current.url;
    console.log(`${command}: ${url}`);
    const code = await watchWorkflow(current, target, ports);
    console.log(`${command}: ${code === 0 ? 'passed' : 'failed'} — ${url}`);
    return code;
  } finally {
    hold.release();
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)
      process.off(signal, stop);
  }
}

if (import.meta.main) {
  try {
    process.exit(await runCommand(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
