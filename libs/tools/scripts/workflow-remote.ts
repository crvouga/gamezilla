#!/usr/bin/env bun
// @io-wall-ok — native Depot CI CLI and git composition root.
/** `bun check`, `bun health`, `bun deploy`: sync, run on Depot and await the verdict. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GitSyncOptions } from './git-sync';
import { gitSync, parseGitSyncArgs } from './git-sync';
import type { DepotTarget, DepotWorkflow } from './workflow-depot';
import { listWorkflows, selectWorkflow, startWorkflow, watchWorkflow } from './workflow-depot';

const DEV_ENV_FILE = join(
  import.meta.dirname,
  '../../infra-shared/tofu/envs/dev.tfvars.json'
);
const GLOBAL_FILE = join(
  import.meta.dirname,
  '../../infra-shared/tofu/global.tfvars.json'
);
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

/** Where the commit's spec report is read: the dev deployment's reports screen. */
function reportUrl(sha: string): string {
  const env = JSON.parse(readFileSync(DEV_ENV_FILE, 'utf8')) as {
    readonly hosts: { readonly apex: string };
  };
  return `https://${env.hosts.apex}/reports/${sha}`;
}

function hasAutomaticCheck(branch: string, sha: string): boolean {
  if (
    run(['git', 'cat-file', '-e', 'origin/main:.depot/workflows/check.yml'])
      .code !== 0
  )
    return false;
  const prs = JSON.parse(
    must([
      'gh',
      'pr',
      'list',
      '--head',
      branch,
      '--base',
      'main',
      '--state',
      'open',
      '--json',
      'headRefOid',
    ])
  ) as readonly { headRefOid: string }[];
  return prs.some((pr) => pr.headRefOid === sha);
}

async function runCommand(argv: readonly string[]): Promise<number> {
  const command = argv[0] ?? '';
  if (!isRemoteCommand(command))
    throw new WorkflowRemoteError(
      'usage: workflow-remote.ts <check|health|deploy> [--message "type(scope): summary"]'
    );
  const policy = WORKFLOW_DISPATCH[command];
  const { branch, sha } = prepareRun(policy, argv.slice(1));
  const config = JSON.parse(readFileSync(GLOBAL_FILE, 'utf8')) as {
    github: { owner: string; repo: string };
    depot: { org_id: string };
  };
  const target: DepotTarget = {
    repository: `${config.github.owner}/${config.github.repo}`,
    org: config.depot.org_id,
    workflow: policy.workflow,
    branch,
    sha,
    automatic: command === 'check' && hasAutomaticCheck(branch, sha),
  };
  // A pull request's Check publishes no report (check.yml `check-reports`).
  if (policy.printsReport && !target.automatic)
    console.log(`${command}: spec report ${reportUrl(sha)}`);
  const hold = holdTTY();
  let current: DepotWorkflow | undefined;
  const ports = {
    run: must,
    sleep: Bun.sleep,
    log: (message: string) => console.log(`${command}: ${message}`),
    onWorkflow: (workflow: DepotWorkflow) => {
      current = workflow;
    },
  };
  let interrupted = false;
  const stop = (signal: NodeJS.Signals) => {
    if (interrupted) return;
    interrupted = true;
    hold.release();
    const workflow =
      current ??
      selectWorkflow(listWorkflows(target, ports), target.workflow, target.sha);
    if (workflow !== undefined)
      run([
        'depot',
        'ci',
        'cancel',
        workflow.run_id,
        '--workflow',
        workflow.workflow_id,
        '--org',
        target.org,
      ]);
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)
    process.once(signal, stop);
  try {
    current = await startWorkflow(target, ports);
    const url = `https://depot.dev/orgs/${target.org}/workflows/${current.workflow_id}`;
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
