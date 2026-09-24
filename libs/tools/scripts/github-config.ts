#!/usr/bin/env bun
// @io-wall-ok — admin CLI entry (gh + GitHub REST)
/**
 * GitHub configuration as code.
 *
 * Every setting this repo applies on GitHub lives in `libs/tools/github-config/` as
 * the REST payload, and this script is the only thing that applies them:
 *
 *   main-protection.json  PUT   repos/<owner>/<repo>/branches/main/protection
 *   repo-settings.json    PATCH repos/<owner>/<repo>
 *
 * The required-check list is **observed, never named by hand**: the script reads
 * the check runs that actually ran on recent pull requests (ours and any app's —
 * GitGuardian included) and requires all of them. Add, rename or drop a check on PRs
 * and `bun run github:config` follows; nothing here needs editing.
 *
 *   bun run github:config          apply every spec
 *   bun run github:config:check    exit 1 if GitHub drifted from the specs
 *
 * Protected branches need GitHub Pro/Team (or a public repo): without one the
 * API answers 403 `Upgrade to GitHub Pro or make this repository public`.
 * `--check` cannot run in Actions — the workflow `permissions:` key has no
 * `administration`, so a job's `GITHUB_TOKEN` cannot read branch protection.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';

const log = createLogger({ name: 'github:config', now: wallClock.now });
const BRANCH = 'main';
const CONFIG_DIR = join(import.meta.dirname, '..', 'github-config');
const PRO_ONLY = /Upgrade to GitHub Pro or make this repository public/u;
/** How many recent PRs to sample when observing check names. */
const PR_SAMPLE = 5;

type Json = Record<string, unknown>;
type Diff = ReadonlyArray<string>;

/** Live payloads wrap these booleans in `{ enabled }`. */
const FLAGS = [
  'enforce_admins',
  'allow_force_pushes',
  'allow_deletions',
] as const;

function gh(args: readonly string[]): {
  status: number;
  stdout: string;
  stderr: string;
} {
  const result = Bun.spawnSync(['gh', ...args], { stderr: 'pipe' });
  return {
    status: result.exitCode ?? 1,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
}

function repoName(): string {
  const result = gh([
    'repo',
    'view',
    '--json',
    'nameWithOwner',
    '--jq',
    '.nameWithOwner',
  ]);
  if (result.status !== 0 || result.stdout === '') {
    throw new Error(
      `could not resolve the repository (is \`gh\` authenticated?): ${result.stderr}`
    );
  }
  return result.stdout;
}

/** Open pull request numbers, most recent first. */
function openPullRequests(repo: string): string[] {
  const listed = gh([
    'pr',
    'list',
    '--repo',
    repo,
    '--state',
    'open',
    '--limit',
    String(PR_SAMPLE),
    '--json',
    'number',
    '--jq',
    '.[].number',
  ]);
  if (listed.status !== 0) return [];
  return listed.stdout.split('\n').filter((line) => line.trim() !== '');
}

/**
 * Every check a pull request reports — ours and any GitHub App's, which no
 * workflow file names. Read from open PRs only: a merged PR's head becomes
 * `main`, so its commit also carries the push-triggered deploy jobs, which never
 * report on a PR and would block every merge if required.
 */
function observedPullRequestChecks(repo: string): string[] {
  const names = new Set<string>();
  for (const number of openPullRequests(repo)) {
    const listed = gh([
      'pr',
      'checks',
      number,
      '--json',
      'name',
      '--jq',
      '.[].name',
    ]);
    for (const line of listed.stdout.split('\n')) {
      const name = line.trim();
      if (name !== '') names.add(name);
    }
  }
  return [...names].sort();
}

function compareFlags(spec: Json, live: Json, diffs: string[]): void {
  for (const key of FLAGS) {
    const actual = (live[key] as { enabled?: unknown } | null)?.enabled;
    if (actual !== spec[key]) {
      diffs.push(`${key}: live=${String(actual)} spec=${String(spec[key])}`);
    }
  }
}

function compareRequiredCheck(
  live: Json,
  contexts: readonly string[],
  diffs: string[]
): void {
  // GitHub omits the key entirely when no check is required.
  const actual = live['required_status_checks'] as Json | null | undefined;
  if (actual === undefined || actual === null) {
    diffs.push('required_status_checks: live=absent (no required check)');
    return;
  }
  if (actual['strict'] !== true) {
    diffs.push(
      `required_status_checks.strict: live=${String(actual['strict'])} expected=true`
    );
  }
  const liveCtx = [
    ...((actual['contexts'] as string[] | undefined) ?? []),
  ].sort();
  if (liveCtx.join('|') !== contexts.join('|')) {
    diffs.push(
      `required_status_checks.contexts: live=${liveCtx.join(',') || 'none'} observed=${contexts.join(',') || 'none'}`
    );
  }
}

function protectionDiffs(
  spec: Json,
  live: Json,
  contexts: readonly string[]
): Diff {
  const diffs: string[] = [];
  compareFlags(spec, live, diffs);
  compareRequiredCheck(live, contexts, diffs);

  const wantReviews = spec['required_pull_request_reviews'] as Json;
  const liveReviews = live['required_pull_request_reviews'] as Json | null;
  if (liveReviews === null) {
    diffs.push(
      'required_pull_request_reviews: live=absent (direct pushes allowed)'
    );
  } else {
    for (const key of Object.keys(wantReviews)) {
      if (liveReviews[key] !== wantReviews[key]) {
        diffs.push(
          `required_pull_request_reviews.${key}: live=${String(liveReviews[key])} spec=${String(wantReviews[key])}`
        );
      }
    }
  }

  if ((live['restrictions'] ?? null) !== spec['restrictions']) {
    diffs.push('restrictions: live differs from spec');
  }
  return diffs;
}

function scalarDiffs(
  spec: Json,
  live: Json,
  _contexts: readonly string[]
): Diff {
  const diffs: string[] = [];
  for (const [key, want] of Object.entries(spec)) {
    if (live[key] !== want) {
      diffs.push(`${key}: live=${String(live[key])} spec=${String(want)}`);
    }
  }
  return diffs;
}

type Spec = {
  readonly file: string;
  readonly method: 'PUT' | 'PATCH';
  readonly path: (repo: string) => string;
  readonly compare: (
    spec: Json,
    live: Json,
    contexts: readonly string[]
  ) => Diff;
};

const SPECS: readonly Spec[] = [
  {
    file: 'main-protection.json',
    method: 'PUT',
    path: (repo) => `repos/${repo}/branches/${BRANCH}/protection`,
    compare: protectionDiffs,
  },
  {
    file: 'repo-settings.json',
    method: 'PATCH',
    path: (repo) => `repos/${repo}`,
    compare: scalarDiffs,
  },
];

function protectionPayload(contexts: readonly string[]): unknown {
  const spec = JSON.parse(
    readFileSync(join(CONFIG_DIR, 'main-protection.json'), 'utf8')
  ) as Json;
  return {
    ...spec,
    required_status_checks: {
      ...(spec['required_status_checks'] as Json),
      contexts: [...contexts],
    },
  };
}

function apply(repo: string): void {
  const contexts = observedPullRequestChecks(repo);
  if (contexts.length === 0) {
    log.warn(
      'no open pull request to observe checks from — leaving main protection unchanged (repo settings still apply).'
    );
  }
  const dir = mkdtempSync(join(tmpdir(), 'gamezilla-github-config-'));
  for (const spec of SPECS) {
    const isProtection = spec.file === 'main-protection.json';
    if (isProtection && contexts.length === 0) continue;
    const payload = isProtection
      ? protectionPayload(contexts)
      : (JSON.parse(readFileSync(join(CONFIG_DIR, spec.file), 'utf8')) as Json);
    const file = join(dir, spec.file);
    writeFileSync(file, JSON.stringify(payload));
    const result = gh([
      'api',
      '--method',
      spec.method,
      spec.path(repo),
      '--input',
      file,
    ]);
    if (result.status !== 0) {
      log.error(
        PRO_ONLY.test(result.stderr)
          ? `protected branches need GitHub Pro/Team (or a public repo): ${result.stderr}`
          : `failed to apply ${spec.file}: ${result.stderr}`
      );
      process.exit(1);
    }
    log.info(
      `${spec.file} applied to ${repo}${isProtection ? ` (required: ${contexts.join(', ')})` : ''}`
    );
  }
}

function check(repo: string): void {
  const contexts = observedPullRequestChecks(repo);
  const drifted: string[] = [];
  for (const spec of SPECS) {
    if (spec.file === 'main-protection.json' && contexts.length === 0) {
      log.warn(
        'no open pull request to observe checks from — skipping the protection comparison.'
      );
      continue;
    }
    const result = gh(['api', spec.path(repo)]);
    if (result.status !== 0) {
      drifted.push(`${spec.file}: cannot read live state — ${result.stderr}`);
      continue;
    }
    const parsed = JSON.parse(
      readFileSync(join(CONFIG_DIR, spec.file), 'utf8')
    ) as Json;
    const live = JSON.parse(result.stdout) as Json;
    for (const diff of spec.compare(parsed, live, contexts)) {
      drifted.push(`${spec.file}: ${diff}`);
    }
  }

  if (drifted.length > 0) {
    log.error('GitHub drifted from libs/tools/github-config/:');
    for (const diff of drifted) log.error(`  ${diff}`);
    log.error('run `bun run github:config` to re-apply the specs.');
    process.exit(1);
  }
  log.info(
    `GitHub matches libs/tools/github-config/ (required checks: ${contexts.join(', ') || 'none'}).`
  );
}

try {
  const repo = repoName();
  if (process.argv.includes('--check')) {
    check(repo);
  } else {
    apply(repo);
  }
} catch (error: unknown) {
  log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
