#!/usr/bin/env bun
// @io-wall-ok — CI entry: reads report buckets on disk, writes the shared reports store.
/**
 * Publish this commit's spec reports to the shared reports store (one R2
 * bucket every environment's API reads, keyed by commit sha; layout in
 * `@pkgs/harness-report`). The Check workflow runs it in three steps:
 *
 *   report-publish.ts prepare          open the attempt, reuse complete
 *                                       cached sources, plan missing outputs
 *   report-publish.ts task <task-id>    publish a completed or restored part
 *   report-publish.ts close [failed]    verify every expected part and close
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
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { wallClock } from '@pkgs/clock';
import { openCommit } from '@pkgs/harness-report/remote/publish';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { run } from '@pkgs/os';
import { publishBatch } from './report-batch';
import {
  createReportPlan,
  finishReport,
  readReportPlan,
  reusePlannedReports,
  taskIdentity,
} from './report-plan';
import { reportsStore } from './report-store';
import { publishReportTask } from './report-task-publish';

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

/** The native job attempt publishing this report, when there is one. */
function runUrl(): string | null {
  return process.env['DEPOT_JOB_URL']?.trim() || null;
}

async function prepareReport(args: {
  readonly store: ObjectStore;
  readonly sha: string;
  readonly runId: string;
  readonly planPath: string;
  readonly plan: ReturnType<typeof readReportPlan>;
}): Promise<void> {
  const startedAtMs = wallClock.now();
  const prepared = createReportPlan(args.plan.tasks, startedAtMs, 30);
  writeFileSync(args.planPath, JSON.stringify(prepared));
  const commit = await openCommit(args.store, {
    sha: args.sha,
    branch: branchName(),
    runUrl: runUrl(),
    startedAtMs,
    frameCss: compileFrameCss(),
    publicationId: args.runId,
  });
  console.log(
    `[report-publish] ${args.sha.slice(0, 9)} open (${commit.branch})`
  );
  const missing = await reusePlannedReports({
    store: args.store,
    sha: args.sha,
    runId: args.runId,
    plan: prepared,
  });
  writeFileSync(`${args.planPath}.missing.json`, JSON.stringify(missing));
  console.log(
    `[report-publish] ${String(missing.length)} source(s) need outputs; published sources reused without snapshot uploads`
  );
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
  const planPath = process.env['CHECK_REPORT_PLAN_PATH'];
  if (planPath === undefined)
    throw new Error('CHECK_REPORT_PLAN_PATH is required');
  const plan = readReportPlan(planPath);
  if (command === 'prepare') {
    await prepareReport({ store, sha, runId: publicationRun, planPath, plan });
    return;
  }
  if (command === 'task' && arg !== undefined) {
    await publishReportTask({
      store,
      repoRoot: REPO_ROOT,
      sha,
      runId: publicationRun,
      taskId: arg,
      identity: taskIdentity(plan, arg),
    });
    return;
  }
  if (command === 'batch') {
    await publishBatch({
      store,
      repoRoot: REPO_ROOT,
      sha,
      runId: publicationRun,
      planPath,
    });
    return;
  }
  if (command === 'close') {
    const commit = await finishReport({
      store,
      sha,
      runId: publicationRun,
      plan,
      endedAtMs: wallClock.now(),
      failed: arg === 'failed',
    });
    console.log(`[report-publish] ${sha.slice(0, 9)} ${String(commit.status)}`);
    return;
  }
  console.error(
    'usage: report-publish.ts prepare | task <task-id> | close [failed]'
  );
  process.exit(1);
}

if (import.meta.main) await main(process.argv.slice(2));
