#!/usr/bin/env bun
// @io-wall-ok — CI gate entry (`//#ci:spec-ownership`) and pre-commit check.
/**
 * Every spec — a `.feature` file, a Quint `.qnt` spec, or a bounded
 * context's ubiquitous language (`specs/glossary.yaml`,
 * `specs/<domain>/glossary.yaml`) — belongs to the spec writer. An implementer never edits
 * a spec, so a commit that touches one is a spec commit and nothing else: its
 * subject starts with `spec:` (or `spec(scope):`) and it changes only specs,
 * catalogs and docs. A commit that mixes a spec change with
 * code is refused — the roles cannot be told apart in it.
 *
 *   check-spec-ownership.ts             commits in PR_BASE..PR_HEAD (CI) or
 *                                       origin/main..HEAD (local)
 *   check-spec-ownership.ts --staged    the index, for the pre-commit hook
 */
import { spawnSync } from 'node:child_process';

export type Commit = {
  readonly sha: string;
  readonly subject: string;
  readonly files: readonly string[];
};

const SPEC_FILE =
  /\.feature$|^specs\/[^/]+\/[^/]+\.qnt$|^specs\/(?:[^/]+\/)?glossary\.yaml$/;
const SPEC_SUBJECT = /^spec(\([^)]*\))?!?:/;
/** What a spec commit may touch besides specs. */
const SPEC_SIDE_FILES = [/(^|\/)STEPS_CATALOG\.md$/, /^docs\/.*\.md$/];

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
    if (specs.length === 0) {
      if (SPEC_SUBJECT.test(commit.subject)) {
        out.push(
          `${label}: a spec: commit must change a spec (a .feature or a specs/<domain>/*.qnt)`
        );
      }
      continue;
    }
    if (!SPEC_SUBJECT.test(commit.subject)) {
      out.push(
        `${label}: changes ${specs.join(', ')} but is not a spec commit — specs/** is the spec writer's; commit spec changes separately with a "spec:" subject`
      );
    }
    if (other.length > 0) {
      out.push(
        `${label}: mixes specs with ${other.join(', ')} — a spec commit changes only specs, glossaries, catalogs and docs`
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
      `staged specs (${specs.join(', ')}) together with ${other.join(', ')} — commit the spec change on its own with a "spec:" subject`,
    ];
  }
  return [];
}

function git(args: readonly string[]): string {
  const result = spawnSync('git', [...args], { encoding: 'utf8' });
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
    ? stagedViolations(
        git(['diff', '--cached', '--name-only'])
          .split('\n')
          .filter((f) => f.length > 0)
      )
    : ownershipViolations(commitsInRange(resolveRange()));
  if (violations.length > 0) {
    console.error('spec ownership check failed:');
    for (const v of violations) console.error(`  ${v}`);
    process.exit(1);
  }
  console.log('ok: specs change only in spec commits');
}
