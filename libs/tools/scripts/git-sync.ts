#!/usr/bin/env bun
// @io-wall-ok — git CLI entry
/**
 * `/git-sync` (.agents/commands/git-sync.md): commit and push all local work
 * on the checked-out feature branch, merge the latest `origin/main` into that
 * same branch, push the merge, and fast-forward local `main` to `origin/main`
 * — so the branch, `origin/<branch>` and local `main` all end up current.
 *
 *   bun run git-sync --message "type(scope): description"
 *   bun run git-sync                 (dirty tree: commit message is generated)
 *   bun run git-sync --trunk-only    (only fast-forward local main)
 *   bun run git-sync --leave-conflicts   (keep a conflicted merge for resolving)
 *
 * On `main` itself it only fast-forwards the checkout. The script owns every
 * git step and every safeguard; the caller only writes the commit message. It
 * never pushes `main`, never force-pushes, never moves local `main` except by
 * fast-forward, and aborts a conflicted merge unless told to leave it.
 */
import { existsSync } from 'node:fs';

import { isSpecFile } from './check-spec-ownership';

/** Conventional Commit header: `<type>(<scope>): <summary>`, same as a PR title. */
const TITLE_PATTERN =
  /^(feat|fix|refactor|test|chore|docs|perf|ci|spec)(\([a-z0-9./-]+\))?!?: \S.*$/;
const TITLE_MAX_LENGTH = 72;
const BASE = 'main';
/** Trunks git-sync refuses outright; `main` itself only gets fast-forwarded. */
const OTHER_TRUNKS: ReadonlySet<string> = new Set(['master', 'dev']);
const IN_PROGRESS = [
  ['MERGE_HEAD', 'merge'],
  ['rebase-merge', 'rebase'],
  ['rebase-apply', 'rebase'],
  ['CHERRY_PICK_HEAD', 'cherry-pick'],
  ['REVERT_HEAD', 'revert'],
] as const;

/** Paths that must never be committed by an automated sync. */
const SECRET_PATHS: readonly RegExp[] = [
  /(^|\/)\.env(\.(?!example$|sample$|template$)[^/]+)?$/u,
  /(^|\/)\.cache\/secrets\//u,
  /\.(pem|key|p12|pfx|keystore|jks)$/u,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/u,
  /(^|\/)(credentials|service-account)[^/]*\.json$/u,
  /(^|\/)\.(npmrc|netrc|pgpass)$/u,
];

export class SyncError extends Error {}

export type GitSyncOptions = {
  /** Commit message for a dirty tree; `null` generates one from the changed paths. */
  readonly message: string | null;
  /** Only fast-forward local `main`; never commit, push or merge. */
  readonly trunkOnly: boolean;
  /** On a merge conflict, leave the merge in progress instead of aborting. */
  readonly leaveConflicts: boolean;
};

type Run = {
  readonly code: number;
  readonly out: string;
  readonly err: string;
};

function git(args: readonly string[]): Run {
  const result = Bun.spawnSync(['git', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    code: result.exitCode ?? 1,
    out: result.stdout.toString().trim(),
    err: result.stderr.toString().trim(),
  };
}

/** Runs git and fails loud with its own output on a non-zero exit. */
function gitOk(args: readonly string[]): string {
  const result = git(args);
  if (result.code !== 0) {
    const detail = [result.err, result.out].filter(Boolean).join('\n');
    throw new SyncError(`git ${args.join(' ')} failed:\n${detail}`);
  }
  return result.out;
}

function step(message: string): void {
  process.stdout.write(`git-sync: ${message}\n`);
}

/** Every reason `message` breaks the commitlint-style rules this repo uses. */
export function validateCommitMessage(message: string): readonly string[] {
  const lines = message.replaceAll('\r\n', '\n').trimEnd().split('\n');
  const header = lines[0] ?? '';
  const violations: string[] = [];
  if (header.trim().length === 0) return ['Commit message is empty.'];
  if (!TITLE_PATTERN.test(header)) {
    violations.push(
      'Header must be `<type>(<scope>): <summary>` with type feat|fix|refactor|test|chore|docs|perf|ci|spec.'
    );
  }
  if (header.length > TITLE_MAX_LENGTH) {
    violations.push(
      `Header is ${String(header.length)} chars; the limit is ${String(TITLE_MAX_LENGTH)}.`
    );
  }
  if (header.trimEnd().endsWith('.')) {
    violations.push('Header must not end with a full stop.');
  }
  if (lines.length > 1 && (lines[1] ?? '').trim() !== '') {
    violations.push('Leave a blank line between the header and the body.');
  }
  return violations;
}

/** Changed paths that look like secrets or credentials. */
export function secretLookingPaths(paths: readonly string[]): string[] {
  return paths.filter((path) =>
    SECRET_PATHS.some((pattern) => pattern.test(path))
  );
}

/** The worktree path that has `branch` checked out, from `git worktree list --porcelain`. */
export function worktreeForBranch(
  porcelain: string,
  branch: string
): string | null {
  let path: string | null = null;
  for (const line of porcelain.split('\n')) {
    if (line.startsWith('worktree ')) path = line.slice('worktree '.length);
    if (line === `branch refs/heads/${branch}`) return path;
  }
  return null;
}

/** Paths from `git status --porcelain=v1 -z -uall`, rename sources included. */
export function parsePorcelainPaths(output: string): string[] {
  const entries = output.split('\0').filter((entry) => entry.length > 0);
  const paths: string[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index] ?? '';
    paths.push(entry.slice(3));
    if (entry[0] === 'R' || entry[0] === 'C') {
      index += 1;
      paths.push(entries[index] ?? '');
    }
  }
  return paths;
}

export function parseGitSyncArgs(argv: readonly string[]): GitSyncOptions {
  let message: string | null = null;
  let trunkOnly = false;
  let leaveConflicts = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? '';
    if (arg === '--message' || arg === '-m') {
      message = argv[index + 1] ?? null;
      index += 1;
    } else if (arg.startsWith('--message=')) {
      message = arg.slice('--message='.length);
    } else if (arg === '--trunk-only') {
      trunkOnly = true;
    } else if (arg === '--leave-conflicts') {
      leaveConflicts = true;
    } else {
      throw new SyncError(`Unknown argument: ${arg}`);
    }
  }
  if (message !== null && message.trim().length === 0) {
    throw new SyncError('--message is empty.');
  }
  if (trunkOnly && message !== null) {
    throw new SyncError('--trunk-only never commits; drop --message.');
  }
  return { message, trunkOnly, leaveConflicts };
}

/** The checked-out branch (a feature branch or `main`), after every refuse-to-run check. */
function preflight(): string {
  const branch = git(['symbolic-ref', '--short', '-q', 'HEAD']);
  if (branch.code !== 0 || branch.out.length === 0) {
    throw new SyncError('Detached HEAD — check out a feature branch first.');
  }
  if (OTHER_TRUNKS.has(branch.out)) {
    throw new SyncError(
      `On trunk branch \`${branch.out}\` — git-sync only runs on a feature branch or \`${BASE}\`.`
    );
  }
  for (const [marker, operation] of IN_PROGRESS) {
    if (existsSync(gitOk(['rev-parse', '--git-path', marker]))) {
      throw new SyncError(
        `A ${operation} is in progress — finish or abort it first.`
      );
    }
  }
  if (git(['remote', 'get-url', 'origin']).code !== 0) {
    throw new SyncError('No `origin` remote.');
  }
  return branch.out;
}

const ROOT_DIRS: ReadonlySet<string> = new Set([
  'apps',
  'libs',
  'pkgs',
  'packages',
]);

/** The package or area a path belongs to: `libs/<x>/…` → `x`, `specs/<x>/…` → `x`. */
function scopeOf(path: string): string | null {
  const [head, next] = path.split('/');
  if (next === undefined) return null;
  const segment =
    head !== undefined && (ROOT_DIRS.has(head) || head === 'specs')
      ? next
      : head;
  const scope = (segment ?? '').toLowerCase().replaceAll(/[^a-z0-9./-]/gu, '-');
  return scope.length > 0 ? scope : null;
}

function isDocPath(path: string): boolean {
  return /\.mdx?$/u.test(path);
}

function isTestPath(path: string): boolean {
  return /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$/u.test(path);
}

function isCiPath(path: string): boolean {
  return path.startsWith('.github/');
}

/** A Conventional Commit header describing `paths`, derived from where they live. */
export function generateCommitMessage(paths: readonly string[]): string {
  const unique = [...new Set(paths)].sort();
  const allSpecs = unique.every((path) => isSpecFile(path));
  const type = allSpecs
    ? 'spec'
    : unique.every(isDocPath)
      ? 'docs'
      : unique.every(isCiPath)
        ? 'ci'
        : unique.every((path) => isTestPath(path) || isDocPath(path))
          ? 'test'
          : 'chore';
  const scopes = new Set(unique.map(scopeOf));
  const [only] = scopes;
  const scope =
    scopes.size === 1 && only !== null && only !== undefined ? `(${only})` : '';
  const [first] = unique;
  const subject =
    unique.length === 1 && first !== undefined
      ? `update ${first.split('/').at(-1) ?? first}`
      : `update ${String(unique.length)} files`;
  const header = `${type}${scope}: ${subject}`;
  if (header.length <= TITLE_MAX_LENGTH) return header;
  const bare = `${type}: ${subject}`;
  return bare.length <= TITLE_MAX_LENGTH
    ? bare
    : `${type}: update ${String(unique.length)} files`;
}

/** `:(literal)` pathspecs so a path is never read as a glob or an option. */
function literal(paths: readonly string[]): string[] {
  return paths.map((path) => `:(literal)${path}`);
}

/**
 * Commits the dirty tree. Without a message one is generated per commit; a
 * tree that mixes specs with anything else becomes a `spec:` commit followed by
 * the rest, because a spec commit may change nothing but specs.
 */
function commitPlan(
  paths: readonly string[],
  message: string | null
): { readonly paths: readonly string[] | null; readonly message: string }[] {
  if (message !== null) return [{ paths: null, message }];
  const specs = paths.filter((path) => isSpecFile(path));
  const rest = paths.filter((path) => !isSpecFile(path));
  if (specs.length === 0 || rest.length === 0) {
    return [{ paths: null, message: generateCommitMessage(paths) }];
  }
  return [
    { paths: specs, message: generateCommitMessage(specs) },
    { paths: null, message: generateCommitMessage(rest) },
  ];
}

/** `git status -z` untrimmed: trimming would eat the first entry's leading space. */
function dirtyStatus(): string {
  const result = Bun.spawnSync(
    ['git', 'status', '--porcelain=v1', '-z', '-uall'],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  if (result.exitCode !== 0) {
    throw new SyncError(
      `git status failed:\n${result.stderr.toString().trim()}`
    );
  }
  return result.stdout.toString();
}

function commitWorkingTree(message: string | null): void {
  const status = dirtyStatus();
  if (status.length === 0) {
    step('working tree clean — nothing to commit.');
    return;
  }
  const paths = parsePorcelainPaths(status);
  const plan = commitPlan(paths, message);
  for (const { message: header } of plan) {
    const violations = validateCommitMessage(header);
    if (violations.length > 0) {
      throw new SyncError(
        `Invalid commit message:\n- ${violations.join('\n- ')}`
      );
    }
  }
  const secrets = secretLookingPaths(paths);
  if (secrets.length > 0) {
    throw new SyncError(
      `Refusing to commit secret-looking paths:\n- ${secrets.join('\n- ')}`
    );
  }
  for (const commit of plan) {
    gitOk(
      commit.paths === null
        ? ['add', '--all']
        : ['add', '--all', '--', ...literal(commit.paths)]
    );
    scanStagedForSecrets();
    gitOk(['commit', '--quiet', '-m', commit.message]);
    step(`committed ${gitOk(['log', '-1', '--format=%h %s'])}`);
  }
}

/** Runs gitleaks over the staged diff when it is installed; unstages on a hit. */
function scanStagedForSecrets(): void {
  if (Bun.which('gitleaks') === null) return;
  const scan = Bun.spawnSync(
    ['gitleaks', 'protect', '--staged', '--redact', '--no-banner'],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  if (scan.exitCode === 0) return;
  gitOk(['reset', '--quiet']);
  throw new SyncError(
    `gitleaks found secrets in the staged diff (changes unstaged, nothing committed):\n${scan.stderr.toString().trim()}`
  );
}

function remoteBranchExists(branch: string): boolean {
  const probe = git(['ls-remote', '--exit-code', '--heads', 'origin', branch]);
  if (probe.code === 0) return true;
  if (probe.code === 2) return false;
  throw new SyncError(`git ls-remote origin failed:\n${probe.err}`);
}

/** Fetches only `origin/main` and, when given and present, `origin/<branch>`. */
function fetchScoped(branch: string | null, remoteExists: boolean): void {
  const refspecs = [`+refs/heads/${BASE}:refs/remotes/origin/${BASE}`];
  if (branch !== null && remoteExists) {
    refspecs.push(`+refs/heads/${branch}:refs/remotes/origin/${branch}`);
  }
  gitOk(['fetch', '--quiet', '--no-tags', '--no-prune', 'origin', ...refspecs]);
}

/**
 * Merges `ref` into HEAD with git's default message. On conflict it aborts,
 * or with `leaveConflicts` keeps the merge in progress for the caller.
 */
function mergeOrAbort(ref: string, leaveConflicts: boolean): void {
  const merge = git(['merge', '--no-edit', '--quiet', ref]);
  if (merge.code === 0) return;
  const conflicts = git(['diff', '--name-only', '--diff-filter=U']).out;
  if (leaveConflicts) {
    throw new SyncError(
      `Merging ${ref} conflicted; the merge is left in progress.\n` +
        `Conflicted paths:\n${conflicts.length > 0 ? conflicts : '(none listed)'}\n` +
        'Resolve and `git add` them, run `GIT_EDITOR=true git merge --continue`, then rerun `bun run git-sync`.'
    );
  }
  git(['merge', '--abort']);
  throw new SyncError(
    `Merging ${ref} conflicted; the merge was aborted and the tree is back at HEAD.\n` +
      `Conflicted paths:\n${conflicts.length > 0 ? conflicts : '(none listed)'}\n${merge.out}`
  );
}

/** Brings local up to `origin/<branch>` when the remote moved ahead. */
function catchUpWithRemote(branch: string, leaveConflicts: boolean): void {
  const counts = gitOk([
    'rev-list',
    '--left-right',
    '--count',
    `origin/${branch}...HEAD`,
  ]);
  const [behind = 0, ahead = 0] = counts.split(/\s+/u).map(Number);
  if (behind === 0) return;
  if (ahead === 0) {
    gitOk(['merge', '--ff-only', '--quiet', `origin/${branch}`]);
    step(`fast-forwarded to origin/${branch} (+${String(behind)}).`);
    return;
  }
  mergeOrAbort(`origin/${branch}`, leaveConflicts);
  step(`merged origin/${branch} (${String(behind)} remote commits).`);
}

function pushBranch(branch: string, setUpstream: boolean): void {
  const args = ['push', '--quiet', '--no-force'];
  if (setUpstream) args.push('--set-upstream');
  gitOk([...args, 'origin', `HEAD:refs/heads/${branch}`]);
  step(`pushed ${gitOk(['rev-parse', '--short', 'HEAD'])} → origin/${branch}.`);
}

/** Merges `origin/main` into the branch; returns false when already contained. */
function mergeBase(leaveConflicts: boolean): boolean {
  const contained = git([
    'merge-base',
    '--is-ancestor',
    `origin/${BASE}`,
    'HEAD',
  ]);
  if (contained.code === 0) {
    step(`already contains origin/${BASE}.`);
    return false;
  }
  mergeOrAbort(`origin/${BASE}`, leaveConflicts);
  step(`merged origin/${BASE}.`);
  return true;
}

function verifySynced(branch: string): void {
  const local = gitOk(['rev-parse', 'HEAD']);
  const remote = gitOk(['ls-remote', 'origin', `refs/heads/${branch}`]).split(
    /\s+/u
  )[0];
  if (remote !== local) {
    throw new SyncError(
      `origin/${branch} is ${remote ?? '(missing)'} but HEAD is ${local}.`
    );
  }
  if (gitOk(['status', '--porcelain=v1', '-uall']).length > 0) {
    throw new SyncError('Working tree is not clean after sync.');
  }
  step(`done — ${branch} @ ${local.slice(0, 9)} matches origin, tree clean.`);
}

/**
 * Fast-forwards local `main` to the fetched `origin/main`. A checkout of
 * `main` (this one or another worktree) moves only when its tree is clean;
 * a local `main` with commits `origin/main` lacks is reported, never moved.
 */
function fastForwardLocalMain(): void {
  const target = gitOk(['rev-parse', `refs/remotes/origin/${BASE}`]);
  const current = git(['rev-parse', '--verify', '-q', `refs/heads/${BASE}`]);
  if (current.code !== 0) {
    gitOk(['branch', '--quiet', '--track', BASE, `origin/${BASE}`]);
    step(`created local ${BASE} at origin/${BASE}.`);
    return;
  }
  if (current.out === target) {
    step(`local ${BASE} already at origin/${BASE}.`);
    return;
  }
  if (git(['merge-base', '--is-ancestor', current.out, target]).code !== 0) {
    step(
      `warning: local ${BASE} has commits origin/${BASE} lacks — left untouched.`
    );
    return;
  }
  const checkout = worktreeForBranch(
    gitOk(['worktree', 'list', '--porcelain']),
    BASE
  );
  if (checkout === null) {
    gitOk(['update-ref', `refs/heads/${BASE}`, target, current.out]);
  } else if (
    gitOk(['-C', checkout, 'status', '--porcelain=v1', '-uno']).length > 0
  ) {
    step(
      `warning: ${BASE} is checked out with local changes at ${checkout} — left untouched.`
    );
    return;
  } else {
    gitOk(['-C', checkout, 'merge', '--ff-only', '--quiet', target]);
  }
  step(`fast-forwarded local ${BASE} → ${target.slice(0, 9)}.`);
}

/** Runs the whole sync; returns the synced branch. */
export function gitSync(options: GitSyncOptions): string {
  const branch = preflight();
  if (options.trunkOnly || branch === BASE) {
    if (branch === BASE && options.message !== null) {
      throw new SyncError(
        `Refusing to commit on \`${BASE}\` — check out a feature branch.`
      );
    }
    fetchScoped(null, false);
    fastForwardLocalMain();
    return branch;
  }
  commitWorkingTree(options.message);
  const remoteExists = remoteBranchExists(branch);
  fetchScoped(branch, remoteExists);
  if (remoteExists) catchUpWithRemote(branch, options.leaveConflicts);
  pushBranch(branch, !remoteExists);
  if (mergeBase(options.leaveConflicts)) pushBranch(branch, false);
  fastForwardLocalMain();
  verifySynced(branch);
  return branch;
}

if (import.meta.main) {
  try {
    gitSync(parseGitSyncArgs(process.argv.slice(2)));
  } catch (error) {
    if (!(error instanceof SyncError)) throw error;
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exit(1);
  }
}
