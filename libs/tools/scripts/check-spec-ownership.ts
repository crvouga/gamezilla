#!/usr/bin/env bun
// @io-wall-ok — CI gate entry (`@libs/tools#ci:spec-ownership`).
/**
 * Every spec — any file under `specs/` (features, Quint models, DMN decision
 * tables, Alloy structures, OpenSLO objectives, the ubiquitous languages, the
 * conformance manifest `specs/conformance.yaml` and the rulebook
 * `specs/README.md`) and any `.feature` file anywhere — belongs to the spec
 * writer. An implementer never edits a spec, so a commit that touches one is a spec commit and nothing else: its
 * subject starts with `spec:` (or `spec(scope):`) or the Conventional Commit
 * equivalent `docs(specs):` (except the rulebook, which requires `spec:`), and it changes only specs
 * and docs (`docs/*.md` and generated `STEPS_CATALOG.md` files). A commit that mixes a spec change with
 * code is refused — the roles cannot be told apart in it.
 *
 *   check-spec-ownership.ts             commits in PR_BASE..PR_HEAD (CI) or
 *                                       origin/main..HEAD (local)
 *   check-spec-ownership.ts --staged    the index
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');

export type Commit = {
  readonly sha: string;
  readonly subject: string;
  readonly files: readonly string[];
};

const SPEC_FILE = /\.feature$|^specs\//;
const SPEC_SUBJECT = /^(?:spec(\([^)]*\))?|docs\(specs\))!?:/;
/** What a spec commit may touch besides specs. */
// Catalogs are now gitignored, but older commits still contain generated docs.
const SPEC_SIDE_FILES = [/^docs\/.*\.md$/, /(?:^|\/)STEPS_CATALOG\.md$/];

export function isSpecFile(path: string): boolean {
  return SPEC_FILE.test(path);
}

function isSpecSideFile(path: string): boolean {
  return SPEC_SIDE_FILES.some((rule) => rule.test(path));
}

/** Every rule the commits break; empty when clean. */
export function ownershipViolations(
  commits: readonly Commit[]
): readonly string[] {
  const out: string[] = [];
  for (const commit of commits) {
    const specs = commit.files.filter(isSpecFile);
    const other = commit.files.filter(
      (f) => !isSpecFile(f) && !isSpecSideFile(f)
    );
    const label = `${commit.sha.slice(0, 10)} "${commit.subject}"`;
    const rulebookUsesDocsSubject =
      commit.files.includes('specs/README.md') &&
      commit.subject.startsWith('docs(specs)');
    if (specs.length === 0) {
      if (SPEC_SUBJECT.test(commit.subject)) {
        out.push(
          `${label}: a spec commit must change a spec (a .feature or a file under specs/)`
        );
      }
      continue;
    }
    if (!SPEC_SUBJECT.test(commit.subject) || rulebookUsesDocsSubject) {
      out.push(
        `${label}: changes ${specs.join(', ')} but is not a spec commit — specs/** is the spec writer's; commit spec changes separately with a "spec:" or "docs(specs):" subject`
      );
    }
    if (other.length > 0) {
      out.push(
        `${label}: mixes specs with ${other.join(', ')} — a spec commit changes only specs/, features and docs`
      );
    }
  }
  return out;
}

/** The index as one pseudo-commit: mixing is refused before it is committed. */
export function stagedViolations(files: readonly string[]): readonly string[] {
  const specs = files.filter(isSpecFile);
  const other = files.filter((f) => !isSpecFile(f) && !isSpecSideFile(f));
  if (specs.length > 0 && other.length > 0) {
    return [
      `staged specs (${specs.join(', ')}) together with ${other.join(', ')} — commit the spec change on its own with a "spec:" or "docs(specs):" subject`,
    ];
  }
  return [];
}

/** Parent commits own automatic spec merges; validate authored resolutions. */
export function mergeStagedViolations(
  staged: readonly string[],
  changedFromIncoming: readonly string[],
  changedFromAutomatic?: readonly string[]
): readonly string[] {
  const changed = new Set(changedFromIncoming);
  const authored = new Set(changedFromAutomatic);
  return stagedViolations(
    staged.filter(
      (file) =>
        changed.has(file) &&
        (changedFromAutomatic === undefined ||
          !isSpecFile(file) ||
          authored.has(file))
    )
  );
}

function changedPaths(ref: string): readonly string[] {
  return git(['diff', '--cached', '--name-only', ref])
    .split('\n')
    .filter(Boolean);
}

/** Older merge strategies lack AUTO_MERGE; retain the parent-only guard. */
function automaticMergeChanges(): readonly string[] | undefined {
  const result = spawnSync(
    'git',
    ['rev-parse', '--verify', '--quiet', 'AUTO_MERGE^{tree}'],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  );
  if (result.status === 1) return undefined;
  if (result.status !== 0)
    throw new Error(`Cannot read automatic merge: ${result.stderr}`);
  return changedPaths(result.stdout.trim());
}

function checkStagedOwnership(): readonly string[] {
  const staged = git(['diff', '--cached', '--name-only'])
    .split('\n')
    .filter(Boolean);
  const merge = spawnSync(
    'git',
    ['rev-parse', '--verify', '--quiet', 'MERGE_HEAD'],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  );
  if (merge.status === 1) return stagedViolations(staged);
  if (merge.status !== 0)
    throw new Error(`Cannot read merge parent: ${merge.stderr}`);
  return mergeStagedViolations(
    staged,
    changedPaths(merge.stdout.trim()),
    automaticMergeChanges()
  );
}

function git(args: readonly string[]): string {
  const result = spawnSync('git', [...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout;
}

function commitsInRange(range: string): readonly Commit[] {
  const shas = git(['rev-list', '--reverse', range])
    .split('\n')
    .filter((s) => s.length > 0);
  return shas.map((sha) => ({
    sha,
    subject: git(['log', '-1', '--format=%s', sha]).trim(),
    files: git([
      'diff-tree',
      '--no-commit-id',
      '--name-only',
      '-r',
      '--root',
      sha,
    ])
      .split('\n')
      .filter((f) => f.length > 0),
  }));
}

function resolveRange(): string {
  const base = process.env['PR_BASE'];
  const head = process.env['PR_HEAD'];
  if (
    base !== undefined &&
    base.length > 0 &&
    head !== undefined &&
    head.length > 0
  ) {
    return `${base}..${head}`;
  }
  return 'origin/main..HEAD';
}

if (import.meta.main) {
  const violations = process.argv.includes('--staged')
    ? checkStagedOwnership()
    : ownershipViolations(commitsInRange(resolveRange()));
  if (violations.length > 0) {
    console.error('spec ownership check failed:');
    for (const v of violations) console.error(`  ${v}`);
    process.exit(1);
  }
  console.log('ok: specs change only in spec commits');
}
