#!/usr/bin/env bun
// @io-wall-ok — CLI composition root: Git and GitHub own repository I/O.
import {
  githubRepository,
  type HygienePull,
  retentionReason,
} from './git-hygiene-policy';

function command(program: string, args: string[]): string {
  const result = Bun.spawnSync([program, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0)
    throw new Error(
      `${program} ${args.join(' ')}: ${result.stderr.toString().trim()}`
    );
  return result.stdout.toString().trim();
}

const git = (...args: string[]) => command('git', args);

let authenticatedGithubCli: string | undefined;

function github(args: string[]): string {
  if (authenticatedGithubCli === undefined) {
    for (const candidate of ['gh', 'gh.exe']) {
      if (Bun.which(candidate) === null) continue;
      const status = Bun.spawnSync([candidate, 'auth', 'status'], {
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 20_000,
      });
      if (status.exitCode === 0) {
        authenticatedGithubCli = candidate;
        break;
      }
    }
  }
  if (authenticatedGithubCli === undefined)
    throw new Error(
      'Sign in to GitHub CLI on this machine; existing Windows logins are supported.'
    );
  return command(authenticatedGithubCli, args);
}

function included(sha: string): boolean {
  const result = Bun.spawnSync(
    ['git', 'merge-base', '--is-ancestor', sha, 'origin/main'],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  if (result.exitCode > 1) throw new Error(result.stderr.toString());
  return result.exitCode === 0;
}

function localBranches(): {
  name: string;
  sha: string;
  worktree: string | null;
}[] {
  return git(
    'for-each-ref',
    '--format=%(refname:short)%09%(objectname)%09%(worktreepath)',
    'refs/heads'
  )
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, sha, worktree] = line.split('\t');
      if (!name || !sha) throw new Error('Invalid branch inventory');
      return { name, sha, worktree: worktree || null };
    });
}

function auditBranch(
  branch: ReturnType<typeof localBranches>[number],
  repo: string
) {
  if (branch.name === 'main') return 'default branch';
  if (branch.worktree !== null)
    return `worktree still attached: ${branch.worktree}`;
  const pulls =
    branch.name === 'main'
      ? []
      : (JSON.parse(
          github([
            'pr',
            'list',
            '--repo',
            repo,
            '--head',
            branch.name,
            '--state',
            'all',
            '--limit',
            '1000',
            '--json',
            'state,headRefOid,baseRefName,mergeCommit',
          ])
        ) as HygienePull[]);
  const proof = pulls.find(
    (pull) =>
      pull.state === 'MERGED' &&
      pull.headRefOid === branch.sha &&
      pull.baseRefName === 'main'
  );
  const remote = git(
    'ls-remote',
    '--heads',
    'origin',
    `refs/heads/${branch.name}`
  );
  return retentionReason({
    ...branch,
    pulls,
    remoteSha: remote ? (remote.split(/\s+/u)[0] ?? null) : null,
    mergeIncluded: proof?.mergeCommit ? included(proof.mergeCommit.oid) : false,
  });
}

export function gitHygiene(apply: boolean): void {
  git('fetch', '--prune', 'origin');
  // Complete the inventory before mutating anything. Authentication failures fail closed.
  const repo = githubRepository(git('remote', 'get-url', 'origin'));
  const inventory = localBranches().map((branch) => ({
    ...branch,
    reason: auditBranch(branch, repo),
  }));
  for (const branch of inventory) {
    if (branch.reason !== null) {
      console.log(
        JSON.stringify({
          branch: branch.name,
          action: 'retained',
          reason: branch.reason,
        })
      );
      continue;
    }
    if (apply) {
      if (git('rev-parse', `refs/heads/${branch.name}`) !== branch.sha)
        throw new Error(`Branch advanced during cleanup: ${branch.name}`);
      // Never force local deletion. Git independently checks integration and
      // refuses branches attached to a worktree, including new attachments.
      git('branch', '-d', branch.name);
    }
    console.log(
      JSON.stringify({
        branch: branch.name,
        action: apply ? 'deleted' : 'eligible',
        sha: branch.sha,
      })
    );
  }
  git('worktree', 'prune', ...(apply ? [] : ['--dry-run']), '--verbose');
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply'))
    throw new Error('Usage: git:hygiene [--apply]');
  gitHygiene(args.includes('--apply'));
}
