#!/usr/bin/env bun
// @io-wall-ok — CI entry: reads report buckets on disk, writes the shared reports store.
/**
 * Publish this commit's spec reports to the shared reports store (one R2
 * bucket every environment's API reads, keyed by commit sha; layout in
 * `@pkgs/harness-report`). The Check workflow runs it in three steps:
 *
 *   report-publish.ts open              the run starts: the commit's record,
 *                                       its index entry and the stylesheet
 *                                       its snapshots use
 *   report-publish.ts task <task-id>   in each shard, as soon as a package's
 *                                       spec part finishes or is restored
 *   report-publish.ts close             after every shard; verifies that this
 *                                       run published every assigned part
 *
 * Each source lands the moment its part is published, so the reports screen
 * (`/reports/<sha>` on any deployment) shows the run filling in. A package
 * whose suite records no harness timeline publishes nothing and is named.
 * The commit is the pull request's head, not the merge commit Actions checks
 * out, so `/reports/<sha>` is the sha `bun check` printed.
 *
 * Needs `REPORTS_BUCKET`, `REPORTS_ENDPOINT`, `REPORTS_WRITE_ACCESS_KEY_ID`
 * and `REPORTS_WRITE_SECRET_ACCESS_KEY` (written by OpenTofu; `secrets-run`
 * loads them). With none of them set, the environment has no reports store
 * yet and every command skips with a warning.
 */

import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { wallClock } from '@pkgs/clock';
import { closeCommit, openCommit } from '@pkgs/harness-report/remote/publish';
import { run } from '@pkgs/os';
import { reportsStore } from './report-store';
import { publishReportTask, verifyPublications } from './report-task-publish';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');

/** `@pkgs/tailwind`: its `node_modules/.bin` holds the CLI it declares. */
export const TAILWIND_DIR = join(REPO_ROOT, 'pkgs/tailwind');
const UI_CSS = [
  join(REPO_ROOT, 'pkgs/ui/src/theme/tokens.css'),
  join(REPO_ROOT, 'pkgs/ui/src/components/skin.css'),
  join(REPO_ROOT, 'pkgs/ui/src/components/hosts.css'),
];

function listModuleCss(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') listModuleCss(path, out);
    } else if (entry.name.endsWith('.module.css')) {
      out.push(path);
    }
  }
}

/**
 * Stylesheet the phone snapshots share: Tailwind, tokens, skin, hosts, and
 * every `pkgs/` CSS module. bun's harness Babel plugin exports unhashed local
 * class names, so the raw module CSS applies. `hosts.css` `@import`s skin,
 * which a sheet concatenated after Tailwind drops, so skin is inlined above.
 */
function compileFrameCss(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'harness-report-css-'));
  try {
    const out = join(tmp, 'tailwind.css');
    run(
      'bunx',
      [
        '--no-install',
        '@tailwindcss/cli',
        '-i',
        join(TAILWIND_DIR, 'src/tailwind.css'),
        '-o',
        out,
      ],
      { cwd: TAILWIND_DIR }
    );
    const modules: string[] = [];
    for (const name of readdirSync(join(REPO_ROOT, 'pkgs')).sort()) {
      const src = join(REPO_ROOT, 'pkgs', name, 'src');
      if (existsSync(src)) listModuleCss(src, modules);
    }
    return [
      readFileSync(out, 'utf8'),
      // `hosts.css` `@import`s skin. A sheet concatenated after Tailwind
      // drops `@import`, so skin is inlined and those lines are removed.
      ...UI_CSS.map((p) =>
        readFileSync(p, 'utf8').replace(/@import\s+[^;]+;/g, '')
      ),
      ...modules.map(
        (p) =>
          `/* ${p.slice(REPO_ROOT.length + 1)} */\n${readFileSync(p, 'utf8')}`
      ),
    ].join('\n');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const REPORTS_ENV = [
  'REPORTS_BUCKET',
  'REPORTS_ENDPOINT',
  'REPORTS_WRITE_ACCESS_KEY_ID',
  'REPORTS_WRITE_SECRET_ACCESS_KEY',
] as const;

/**
 * True when none of the reports credentials exist: the environment's
 * foundation stack has not been applied since it gained the reports bucket
 * (Deploy applies it), so there is no store to publish to yet. A partly set
 * credential is a misconfiguration and still fails in `required`.
 */
export function reportsStoreUnconfigured(
  env: Readonly<Record<string, string | undefined>>
): boolean {
  return REPORTS_ENV.every((name) => (env[name]?.trim() ?? '') === '');
}

function git(args: readonly string[]): string {
  const result = Bun.spawnSync(['git', ...args], { cwd: REPO_ROOT });
  return result.stdout.toString().trim();
}

function headSha(): string {
  return (
    process.env['PR_HEAD']?.trim() ||
    process.env['GITHUB_SHA']?.trim() ||
    git(['rev-parse', 'HEAD'])
  );
}

function branchName(): string {
  return (
    process.env['GITHUB_HEAD_REF']?.trim() ||
    process.env['GITHUB_REF_NAME']?.trim() ||
    git(['rev-parse', '--abbrev-ref', 'HEAD'])
  );
}

/** The Actions run publishing this report, when there is one. */
function runUrl(): string | null {
  const server = process.env['GITHUB_SERVER_URL']?.trim();
  const repo = process.env['GITHUB_REPOSITORY']?.trim();
  const id = process.env['GITHUB_RUN_ID']?.trim();
  return server && repo && id ? `${server}/${repo}/actions/runs/${id}` : null;
}

async function main(argv: readonly string[]): Promise<void> {
  const [command, arg] = argv;
  if (reportsStoreUnconfigured(process.env)) {
    if (process.env['GITHUB_ACTIONS'] === 'true')
      throw new Error('CI requires the reports store');
    console.log(
      '::warning::report-publish: no reports store in this secrets environment yet (Deploy creates it); nothing published'
    );
    return;
  }
  const store = reportsStore();
  const sha = headSha();
  const publicationRun = `${process.env['GITHUB_RUN_ID'] ?? 'local'}:${process.env['GITHUB_RUN_ATTEMPT'] ?? '1'}`;
  if (command === 'open') {
    const commit = await openCommit(store, {
      sha,
      branch: branchName(),
      runUrl: runUrl(),
      startedAtMs: wallClock.now(),
      frameCss: compileFrameCss(),
    });
    console.log(`[report-publish] ${sha.slice(0, 9)} open (${commit.branch})`);
    return;
  }
  if (command === 'task' && arg !== undefined) {
    await publishReportTask({
      store,
      repoRoot: REPO_ROOT,
      sha,
      runId: publicationRun,
      taskId: arg,
    });
    return;
  }
  if (command === 'close') {
    const assignment = process.env['SHARD_ASSIGNMENT'];
    if (assignment === undefined)
      throw new Error('Closing a report requires SHARD_ASSIGNMENT');
    await verifyPublications({
      store,
      sha,
      runId: publicationRun,
      taskIds: (JSON.parse(assignment) as string[][]).flat(),
    });
    const commit = await closeCommit(store, {
      sha,
      endedAtMs: wallClock.now(),
    });
    console.log(`[report-publish] ${sha.slice(0, 9)} ${String(commit.status)}`);
    return;
  }
  console.error('usage: report-publish.ts open | task <task-id> | close');
  process.exit(1);
}

if (import.meta.main) await main(process.argv.slice(2));
