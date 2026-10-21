// @io-wall-ok — report producers capture the revision they execute, before their run.
import { spawnSync } from 'node:child_process';

export type ReportOrigin = { readonly sha: string; readonly clean: boolean };

export function reportOrigin(repoRoot: string): ReportOrigin {
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const state = spawnSync('git', ['status', '--porcelain'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (sha.status !== 0 || state.status !== 0)
    throw new Error('Cannot identify report revision');
  return { sha: sha.stdout.trim(), clean: state.stdout.trim().length === 0 };
}

/** The checked-out revision, without the cost of comparing the working tree. */
export function reportRevision(repoRoot: string): string | null {
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return sha.status === 0 ? sha.stdout.trim() : null;
}

/** The branch a local run executes; a detached checkout has none. */
export function reportBranch(repoRoot: string): string | null {
  const branch = spawnSync('git', ['branch', '--show-current'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return branch.status === 0 && branch.stdout.trim().length > 0
    ? branch.stdout.trim()
    : null;
}

export function completedOrigin(
  started: ReportOrigin,
  ended: ReportOrigin
): ReportOrigin {
  return {
    sha: started.sha,
    clean: started.clean && ended.clean && started.sha === ended.sha,
  };
}
