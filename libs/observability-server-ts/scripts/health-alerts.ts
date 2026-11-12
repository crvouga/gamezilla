#!/usr/bin/env bun
// @io-wall-ok — CLI: reads Health's objective failures, runs read-only bun obs queries, writes the work items.
/**
 * The Health workflow's evidence step, after `health:objectives` has run for
 * every environment. Each run leaves its environment's failed checks in
 * `.cache/health-alerts/failures-<env>.json` (`apps/product-ts/scripts/health.ts`);
 * this turns them into one work item per failing objective per environment
 * (`src/alert-work-items.ts`), each with the evidence its investigate command
 * finds through `bun obs --json` with CI's credentials, and writes:
 *
 *   .cache/health-alerts/work-items.json   the document (`bun alerts --json` reads the same)
 *   .cache/health-alerts/work-items.md     the same for people; also the job summary
 *   stdout                                 the Markdown, then one `HEALTH_ALERTS_V1 <base64>`
 *                                          line that `bun alerts` reads from the job log
 *
 * It never fails the job: the objectives step already carries the verdict,
 * and an evidence query that cannot run says so in its work item.
 *
 *   bun run libs/observability-server-ts/scripts/health-alerts.ts [--dir <dir>]
 */

import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import type { ObjectiveFailure } from '@pkgs/openslo-shared-ts/failure';
import { isObjectiveFailure } from '@pkgs/openslo-shared-ts/failure';
import type { ObsOutcome } from '../src/alert-evidence';
import { buildWorkItemsDocument } from '../src/alert-evidence';
import { redact } from '../src/alert-work-items';
import {
  encodeLogBlock,
  renderWorkItems,
} from '../src/alert-work-items-render';

const REPO_ROOT = resolve(import.meta.dir, '../../..');
const OBS_ENTRY = join(REPO_ROOT, 'libs/secrets-server-ts/scripts/obs.ts');
/** One query; Tempo answers a day's search in seconds. */
const QUERY_TIMEOUT_MS = 60_000;
/** Every query of the run; the step's own timeout sits above it. */
const EVIDENCE_BUDGET_MS = 5 * 60_000;
const FAILURES_FILE = /^failures-(.+)\.json$/;

function dirArg(argv: readonly string[]): string {
  const at = argv.indexOf('--dir');
  const given = at === -1 ? undefined : argv[at + 1];
  return resolve(REPO_ROOT, given ?? '.cache/health-alerts');
}

function readFailures(dir: string): {
  readonly environments: readonly string[];
  readonly failures: readonly ObjectiveFailure[];
} {
  if (!existsSync(dir)) return { environments: [], failures: [] };
  const environments: string[] = [];
  const failures: ObjectiveFailure[] = [];
  for (const name of readdirSync(dir).sort()) {
    const match = FAILURES_FILE.exec(name);
    if (match === null) continue;
    environments.push(match[1] ?? '');
    const parsed: unknown = JSON.parse(readFileSync(join(dir, name), 'utf8'));
    if (Array.isArray(parsed))
      failures.push(...parsed.filter(isObjectiveFailure));
  }
  return { environments, failures };
}

function runObs(args: readonly string[]): ObsOutcome {
  const run = spawnSync(process.execPath, [OBS_ENTRY, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: QUERY_TIMEOUT_MS,
    maxBuffer: 32 * 1_048_576,
    env: { ...process.env, NO_COLOR: '1' },
  });
  return {
    code: run.error === undefined ? run.status : null,
    stdout: run.stdout ?? '',
    stderr: run.stderr ?? '',
  };
}

function main(): void {
  const dir = dirArg(process.argv.slice(2));
  const { environments, failures } = readFailures(dir);
  const startMs = wallClock.now();
  const doc = buildWorkItemsDocument({
    failures,
    environments,
    generatedAt: new Date(startMs).toISOString(),
    ports: {
      obs: runObs,
      nowMs: () => wallClock.now(),
      deadlineMs: startMs + EVIDENCE_BUDGET_MS,
    },
  });
  const markdown = renderWorkItems(doc);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'work-items.json'),
    `${JSON.stringify(doc, null, 2)}\n`
  );
  writeFileSync(join(dir, 'work-items.md'), markdown);
  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (summary !== undefined && summary !== '')
    appendFileSync(summary, `${markdown}\n`);
  process.stdout.write(`${markdown}\n${encodeLogBlock(doc)}\n`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(
    `::warning::health alerts: the work items were not written: ${redact(message)}\n`
  );
}
