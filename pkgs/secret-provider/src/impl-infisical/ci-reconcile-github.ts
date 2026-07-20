import { spawnSync } from 'node:child_process';
import type { ReconcileFail, ReconcileLog } from './ci-reconcile-types';

function trimEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

export function runGh(
  repoRoot: string,
  args: readonly string[],
  fail: ReconcileFail
): { status: number; stdout: string } {
  const result = spawnSync('gh', [...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.error !== undefined) {
    fail(
      `failed to run gh: ${result.error.message} (is the GitHub CLI installed + authed?)`
    );
  }
  return { status: result.status ?? 1, stdout: (result.stdout ?? '').trim() };
}

export function resolveGithubRepo(args: {
  readonly repoRoot: string;
  readonly cliRepo: string | null | undefined;
  readonly fail: ReconcileFail;
}): string {
  if (
    args.cliRepo !== null &&
    args.cliRepo !== undefined &&
    args.cliRepo.length > 0
  ) {
    return args.cliRepo;
  }
  const fromEnv = trimEnv('GITHUB_REPOSITORY');
  if (fromEnv.length > 0) return fromEnv;
  const { status, stdout } = runGh(
    args.repoRoot,
    ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
    args.fail
  );
  if (status !== 0 || stdout.length === 0) {
    args.fail('Could not resolve GitHub repo — pass --repo <owner/name>.');
  }
  return stdout;
}

export function readGithubVariable(args: {
  readonly repoRoot: string;
  readonly repo: string;
  readonly name: string;
  readonly fail: ReconcileFail;
}): string {
  const { status, stdout } = runGh(
    args.repoRoot,
    ['variable', 'get', args.name, '--repo', args.repo],
    args.fail
  );
  return status === 0 ? stdout : '';
}

export function setGithubVariable(args: {
  readonly repoRoot: string;
  readonly repo: string;
  readonly name: string;
  readonly value: string;
  readonly dryRun: boolean;
  readonly log: ReconcileLog;
  readonly fail: ReconcileFail;
}): void {
  const current = readGithubVariable({
    repoRoot: args.repoRoot,
    repo: args.repo,
    name: args.name,
    fail: args.fail,
  });
  if (current === args.value) {
    args.log(`${args.name} already set correctly — skipping.`);
    return;
  }
  if (args.dryRun) {
    args.log(
      `DRY RUN: would set ${args.name}=${args.value} (was "${current}").`
    );
    return;
  }
  const { status } = runGh(
    args.repoRoot,
    [
      'variable',
      'set',
      args.name,
      '--repo',
      args.repo,
      '--body',
      args.value,
    ],
    args.fail
  );
  if (status !== 0) args.fail(`Failed to set GitHub variable ${args.name}.`);
  args.log(`Set ${args.name}=${args.value}.`);
}
