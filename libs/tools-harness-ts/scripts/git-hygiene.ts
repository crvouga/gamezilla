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

/** True when no commit on `sha` is a patch `origin/main` lacks. */
function patchEquivalent(sha: string): boolean {
  const result = Bun.spawnSync(['git', 'cherry', 'origin/main', sha], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return !result.stdout
    .toString()
    .split('\n')
    .some((line) => line.startsWith('+'));
}

function integrated(sha: string): boolean {
  return included(sha) || patchEquivalent(sha);
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

function remoteHeads(): Map<string, string> {
  const heads = new Map<string, string>();
  for (const line of git('ls-remote', '--heads', 'origin').split('\n')) {
    if (line === '') continue;
    const [sha, ref] = line.split(/\s+/u);
    const name = ref?.replace(/^refs\/heads\//u, '');
    if (!sha || !name) throw new Error(`Invalid remote head: ${line}`);
    heads.set(name, sha);
  }
  return heads;
}

function auditBranch(
  branch: ReturnType<typeof localBranches>[number],
  repo: string,
  remotes: ReadonlyMap<string, string>
) {
  if (branch.name === 'main' || branch.name === 'archive')
    return 'default or archive branch';
  if (branch.worktree !== null)
    return `worktree still attached: ${branch.worktree}`;
  const remoteSha = remotes.get(branch.name) ?? null;
  const onMain = integrated(branch.sha);
  // Already on main: skip the per-branch pull query. An open PR is the only
  // remaining hold, and the caller passes that set in one query.
  if (onMain) {
    return retentionReason({
      ...branch,
      pulls: [],
      remoteSha,
      mergeIncluded: true,
      integrated: true,
    });
  }
  const pulls = JSON.parse(
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
  ) as HygienePull[];
  const proof = pulls.find(
    (pull) =>
      pull.state === 'MERGED' &&
      pull.headRefOid === branch.sha &&
      pull.baseRefName === 'main'
  );
  return retentionReason({
    ...branch,
    pulls,
    remoteSha,
    mergeIncluded: proof?.mergeCommit ? included(proof.mergeCommit.oid) : false,
    integrated: false,
  });
}

function openPullHeads(repo: string): Set<string> {
  return new Set(
    (
      JSON.parse(
        github([
          'pr',
          'list',
          '--repo',
          repo,
          '--state',
          'open',
          '--limit',
          '1000',
          '--json',
          'headRefName',
        ])
      ) as { headRefName: string }[]
    ).map((pull) => pull.headRefName)
  );
}

export function gitHygiene(apply: boolean): void {
  git('fetch', '--prune', 'origin');
  // Complete the inventory before mutating anything. Authentication failures fail closed.
  const repo = githubRepository(git('remote', 'get-url', 'origin'));
  const openHeads = openPullHeads(repo);
  const remotes = remoteHeads();
  const inventory = localBranches().map((branch) => ({
    ...branch,
    reason: openHeads.has(branch.name)
      ? 'open PR'
      : auditBranch(branch, repo, remotes),
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
      // `-d` refuses a squash-merged head that is not an ancestor. `-D` runs
      // only after `integrated` proved every patch is already on origin/main.
      const soft = Bun.spawnSync(['git', 'branch', '-d', branch.name], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      if (soft.exitCode !== 0) {
        if (!integrated(branch.sha))
          throw new Error(soft.stderr.toString().trim());
        git('branch', '-D', branch.name);
      }
      dropBranchConfig(branch.name);
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
  if (!apply) return;
  dropStaleBranchConfig();
  // Reflog entries for deleted tips are unreachable. Drop those, then
  // unreachable objects. Reachable reflogs stay so active worktrees can recover.
  git('reflog', 'expire', '--expire-unreachable=now', '--all');
  git('gc', '--prune=now');
}

/** Removes `branch.<name>.*` left behind after the ref is gone. */
function dropBranchConfig(name: string): void {
  const result = Bun.spawnSync(
    ['git', 'config', '--local', '--remove-section', `branch.${name}`],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  if (
    result.exitCode !== 0 &&
    !result.stderr.toString().includes('no such section')
  )
    throw new Error(result.stderr.toString().trim());
}

/** Drops `branch.*` sections whose ref no longer exists. */
function dropStaleBranchConfig(): void {
  const live = new Set(localBranches().map((branch) => branch.name));
  const listed = Bun.spawnSync(
    ['git', 'config', '--local', '--name-only', '--get-regexp', '^branch\\.'],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  if (listed.exitCode !== 0) {
    if (listed.stdout.toString().trim() === '') return;
    throw new Error(listed.stderr.toString().trim());
  }
  const stale = new Set<string>();
  for (const key of listed.stdout.toString().split('\n')) {
    if (key === '') continue;
    const match = /^branch\.(.*)\.[^.]+$/u.exec(key);
    if (!match?.[1] || live.has(match[1])) continue;
    stale.add(match[1]);
  }
  for (const name of stale) dropBranchConfig(name);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply'))
    throw new Error('Usage: git:hygiene [--apply]');
  gitHygiene(args.includes('--apply'));
}
