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

import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { wallClock } from '@pkgs/clock-shared/wall';
import { openCommit } from '@pkgs/harness-report-shared/publish';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';
import { compileFrameCss } from '@libs/harness/wall-frame-css';
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
    frameCss: compileFrameCss(REPO_ROOT),
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
