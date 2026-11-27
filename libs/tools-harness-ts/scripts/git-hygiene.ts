#!/usr/bin/env bun
// @io-wall-ok — CLI composition root: Git and GitHub own repository I/O.
import {
  githubRepository,
  type HygienePull,
  hygieneDecision,
  IDLE_DAYS,
} from './git-hygiene-policy';

function command(program: string, args: string[]): string {
  const result = Bun.spawnSync([program, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, NO_COLOR: '1', GH_NO_COLOR: '1' },
  });
  const stdout = result.stdout.toString().replace(/\u001b\[[0-9;]*m/gu, '');
  if (result.exitCode !== 0)
    throw new Error(
      `${program} ${args.join(' ')}: ${result.stderr.toString().trim()}`
    );
  // Some CLIs write progress before JSON. Keep from the first JSON value.
  const jsonAt = stdout.search(/[[{]/u);
  return (jsonAt > 0 ? stdout.slice(jsonAt) : stdout).trim();
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

function ancestorOf(sha: string, ref: string): boolean {
  const result = Bun.spawnSync(
    ['git', 'merge-base', '--is-ancestor', sha, ref],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  if (result.exitCode > 1) throw new Error(result.stderr.toString());
  return result.exitCode === 0;
}

function integrated(sha: string): boolean {
  return included(sha) || patchEquivalent(sha);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function idle(sha: string): boolean {
  const committedAt = Number(git('log', '-1', '--format=%ct', sha)) * 1000;
  if (!Number.isFinite(committedAt))
    throw new Error(`No commit time for ${sha}`);
  return Date.now() - committedAt >= IDLE_DAYS * DAY_MS;
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
): ReturnType<typeof hygieneDecision> {
  if (branch.name === 'main' || branch.name === 'archive')
    return { reason: 'default or archive branch', force: false };
  if (branch.worktree !== null)
    return {
      reason: `worktree still attached: ${branch.worktree}`,
      force: false,
    };
  const remoteSha = remotes.get(branch.name) ?? null;
  const onMain = integrated(branch.sha);
  const archived = ancestorOf(branch.sha, 'origin/archive');
  // Already on main or archive: skip the per-branch pull query. An open PR
  // is the only remaining hold, and the caller passes that set in one query.
  if (onMain || archived) {
    return hygieneDecision({
      ...branch,
      pulls: [],
      remoteSha,
      mergeIncluded: onMain,
      integrated: onMain,
      archived,
      idle: idle(branch.sha),
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
  return hygieneDecision({
    ...branch,
    pulls,
    remoteSha,
    mergeIncluded: proof?.mergeCommit ? included(proof.mergeCommit.oid) : false,
    integrated: false,
    archived: false,
    idle: idle(branch.sha),
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
    ...(openHeads.has(branch.name)
      ? { reason: 'open PR', force: false }
      : auditBranch(branch, repo, remotes)),
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
      // `-d` refuses a squash-merged or archived head that is not an ancestor
      // of HEAD. `-D` runs only after the tip is on origin/main or origin/archive.
      const soft = Bun.spawnSync(['git', 'branch', '-d', branch.name], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      if (soft.exitCode !== 0) {
        if (!branch.force) throw new Error(soft.stderr.toString().trim());
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
