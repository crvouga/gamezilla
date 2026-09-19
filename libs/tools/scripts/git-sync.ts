#!/usr/bin/env bun
// @io-wall-ok — git CLI entry
/**
 * `/git-sync` (.agents/commands/git-sync.md): commit and push all local work
 * on the checked-out feature branch, then merge the latest `origin/main` into
 * that same branch and push the merge.
 *
 *   bun run git-sync --message "type(scope): description"
 *   bun run git-sync                 (clean tree: sync only)
 *
 * The script owns every git step and every safeguard; the caller only writes
 * the commit message. It never touches local or remote `main`, never
 * force-pushes, and aborts a conflicted merge before exiting.
 */
import { existsSync } from 'node:fs';
import { TITLE_MAX_LENGTH, TITLE_PATTERN } from './check-pr-body';

const BASE = 'main';
const TRUNKS: ReadonlySet<string> = new Set(['main', 'master', 'dev']);
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

class SyncError extends Error {}

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
      'Header must be `<type>(<scope>): <summary>` with type feat|fix|refactor|test|chore|docs|perf|ci.'
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

function parseArgs(argv: readonly string[]): { message: string | null } {
  let message: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? '';
    if (arg === '--message' || arg === '-m') {
      message = argv[index + 1] ?? null;
      index += 1;
    } else if (arg.startsWith('--message=')) {
      message = arg.slice('--message='.length);
    } else {
      throw new SyncError(`Unknown argument: ${arg}`);
    }
  }
  if (message !== null && message.trim().length === 0) {
    throw new SyncError('--message is empty.');
  }
  return { message };
}

/** The checked-out feature branch, after every refuse-to-run check. */
function preflight(): string {
  const branch = git(['symbolic-ref', '--short', '-q', 'HEAD']);
  if (branch.code !== 0 || branch.out.length === 0) {
    throw new SyncError('Detached HEAD — check out a feature branch first.');
  }
  if (TRUNKS.has(branch.out)) {
    throw new SyncError(
      `On trunk branch \`${branch.out}\` — git-sync only runs on a feature branch.`
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

function commitWorkingTree(message: string | null): void {
  const status = gitOk(['status', '--porcelain=v1', '-z', '-uall']);
  if (status.length === 0) {
    step('working tree clean — nothing to commit.');
    return;
  }
  if (message === null) {
    throw new SyncError(
      'Working tree has changes — pass --message "type(scope): description".'
    );
  }
  const violations = validateCommitMessage(message);
  if (violations.length > 0) {
    throw new SyncError(
      `Invalid commit message:\n- ${violations.join('\n- ')}`
    );
  }
  const secrets = secretLookingPaths(parsePorcelainPaths(status));
  if (secrets.length > 0) {
    throw new SyncError(
      `Refusing to commit secret-looking paths:\n- ${secrets.join('\n- ')}`
    );
  }
  gitOk(['add', '--all']);
  scanStagedForSecrets();
  gitOk(['commit', '--quiet', '-m', message]);
  step(`committed ${gitOk(['log', '-1', '--format=%h %s'])}`);
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

/** Fetches only `origin/main` and, when it exists, `origin/<branch>`. */
function fetchScoped(branch: string, remoteExists: boolean): void {
  const refspecs = [`+refs/heads/${BASE}:refs/remotes/origin/${BASE}`];
  if (remoteExists) {
    refspecs.push(`+refs/heads/${branch}:refs/remotes/origin/${branch}`);
  }
  gitOk(['fetch', '--quiet', '--no-tags', '--no-prune', 'origin', ...refspecs]);
}

/** Merges `ref` into HEAD with git's default message; aborts on conflict. */
function mergeOrAbort(ref: string): void {
  const merge = git(['merge', '--no-edit', '--quiet', ref]);
  if (merge.code === 0) return;
  const conflicts = git(['diff', '--name-only', '--diff-filter=U']).out;
  git(['merge', '--abort']);
  throw new SyncError(
    `Merging ${ref} conflicted; the merge was aborted and the tree is back at HEAD.\n` +
      `Conflicted paths:\n${conflicts.length > 0 ? conflicts : '(none listed)'}\n${merge.out}`
  );
}

/** Brings local up to `origin/<branch>` when the remote moved ahead. */
function catchUpWithRemote(branch: string): void {
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
  mergeOrAbort(`origin/${branch}`);
  step(`merged origin/${branch} (${String(behind)} remote commits).`);
}

function pushBranch(branch: string, setUpstream: boolean): void {
  const args = ['push', '--quiet', '--no-force'];
  if (setUpstream) args.push('--set-upstream');
  gitOk([...args, 'origin', `HEAD:refs/heads/${branch}`]);
  step(`pushed ${gitOk(['rev-parse', '--short', 'HEAD'])} → origin/${branch}.`);
}

/** Merges `origin/main` into the branch; returns false when already contained. */
function mergeBase(): boolean {
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
  mergeOrAbort(`origin/${BASE}`);
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

function main(argv: readonly string[]): void {
  const { message } = parseArgs(argv);
  const branch = preflight();
  commitWorkingTree(message);
  const remoteExists = remoteBranchExists(branch);
  fetchScoped(branch, remoteExists);
  if (remoteExists) catchUpWithRemote(branch);
  pushBranch(branch, !remoteExists);
  if (mergeBase()) pushBranch(branch, false);
  verifySynced(branch);
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof SyncError)) throw error;
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exit(1);
  }
}
