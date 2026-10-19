// @io-wall-ok — isolated CI shard process composition root.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { reportTask } from '@libs/harness/report-ready';
import { SECRETS_RANGE_ENV } from './secrets-scan-range';
import { turboChildEnv, writePlatformCacheKey } from './turbo-ci-run';
import { readLatestRunSummary, SLOW_RUNNER_MULTIPLIER } from './verify-budget';
import { packShardEvidence } from './verify-evidence-pack';
import { preserveInterruptedModels } from './verify-interrupted-models';
import { preserveInterruptedReports } from './verify-interrupted-reports';
import { copyModelEvidence } from './verify-model-evidence';
import { packPlan } from './verify-plan-transfer';
import { activeProfile } from './verify-profile';
import { executeShard } from './verify-shard-process';
import type { Result } from './verify-shard-results';
import { collectResults } from './verify-shard-results';
import { redactSecrets } from './verify-shard-stream';
import type { VerifyPlan } from './verify-shards';
import { validatePlan } from './verify-shards';
import { prepareStage, stageCachePaths } from './verify-stage-cache';

const ROOT = join(import.meta.dirname, '../../..');
const DIRECTORY = join(ROOT, '.cache/verify-ci');
/** `@pkgs/quint-shared/wall` scales a proof's declared deadline by it. */
const VERIFY_TIME_SCALE_ENV = 'QUINT_VERIFY_TIME_SCALE';

export async function runShard(index: number): Promise<number> {
  const start = process.hrtime.bigint();
  const plan = JSON.parse(
    readFileSync(join(DIRECTORY, 'plan.json'), 'utf8')
  ) as VerifyPlan;
  validatePlan(plan);
  const shard = plan.shards[index];
  if (!shard) throw new Error(`Unknown shard ${index}`);
  const env = turboChildEnv();
  applyPlanContext(env);
  // A shard runs on the 2-core runner: a proof gets the same correction to
  // its deadline that every task gets to its budget.
  env[VERIFY_TIME_SCALE_ENV] ??= String(SLOW_RUNNER_MULTIPLIER);
  const misses = shard.tasks.filter((task) => !task.hit);
  const prefetchStart = process.hrtime.bigint();
  const { dependencies, missing, blocked } = await prepareStage(
    plan,
    shard,
    env,
    ROOT
  );
  for (const task of missing)
    console.error(
      `Missing prerequisite artifact: ${task.taskId} (${task.hash}); dependent tasks fail without duplicate execution`
    );
  const needed = new Set(dependencies.map((task) => task.taskId));
  const execute = misses
    .filter((task) => !blocked.has(task.taskId))
    .map((task) => task.taskId);
  const prefetchMs = Number(process.hrtime.bigint() - prefetchStart) / 1e6;
  const executionStart = process.hrtime.bigint();
  const status = execute.length
    ? await executeShard(execute, env, [...shard.tasks, ...dependencies])
    : 0;
  const executionMs = Number(process.hrtime.bigint() - executionStart) / 1e6;
  const summary = execute.length ? readLatestRunSummary(ROOT) : null;
  const { results, verdict } = collectResults({
    plan,
    shard,
    summary,
    needed,
    status: status || (blocked.size > 0 ? 1 : 0),
    env,
  });
  const actualMs = Number(process.hrtime.bigint() - start) / 1e6;
  mkdirSync(join(DIRECTORY, 'results'), { recursive: true });
  const result = {
    index,
    taskCount: shard.tasks.length,
    estimatedSeconds: shard.seconds,
    actualMs,
    prefetchMs,
    executionMs,
    verdict,
    hits: results.filter((task) => task.cache === 'HIT').length,
    tasks: results,
  };
  writeFileSync(
    join(DIRECTORY, 'results', `shard-${index}.json`),
    JSON.stringify(result)
  );
  transferEvidence(index, results, env, verdict !== 0);
  console.log(
    `shard ${index}: ${shard.tasks.length} tasks; estimated ${shard.seconds.toFixed(1)} task-seconds; actual ${(actualMs / 1000).toFixed(3)}s; ${result.hits} hits; ${misses.length} planned misses; prefetch ${prefetchMs.toFixed(0)}ms`
  );
  return verdict;
}

function transferEvidence(
  index: number,
  results: readonly Result[],
  env: NodeJS.ProcessEnv,
  failed: boolean
): void {
  try {
    // The `pr` profile keeps no report: a failure is read from the job log.
    if (activeProfile(env).reports) {
      preserveInterruptedReports(ROOT, results);
      preserveFailedReports(results);
    }
    packEvidence(index, failed);
  } catch (error) {
    console.error(
      redactSecrets(`Evidence transfer unavailable: ${String(error)}`, env)
    );
    throw error;
  }
}

function packEvidence(index: number, failed: boolean): void {
  const paths = [`.cache/verify-ci/results/shard-${index}.json`];
  const plan = JSON.parse(
    readFileSync(join(DIRECTORY, 'plan.json'), 'utf8')
  ) as VerifyPlan;
  paths.push(...stageCachePaths(plan, plan.shards[index]!, ROOT, failed));
  if (plan.shards[index]!.stage === 'prerequisites') {
    writeFileSync(join(DIRECTORY, 'plan.payload'), packPlan());
    paths.push('.cache/verify-ci/plan.payload');
  }
  if (existsSync(join(DIRECTORY, 'failed-reports')))
    paths.push('.cache/verify-ci/failed-reports');
  packShardEvidence(ROOT, index, paths);
}

function preserveFailedReports(results: readonly Result[]): void {
  for (const result of results.filter((task) => !task.passed)) {
    if (
      /#verify:models(?::\d+){0,2}$/.test(result.taskId) ||
      result.taskId === '@apps/product#test:contract' ||
      /@apps\/product#test:contract:\d+$/.test(result.taskId)
    ) {
      const task = result.taskId.slice(0, result.taskId.indexOf('#'));
      const modelPath = join(
        task.replace('@', ''),
        '.cache/harness-report/models'
      );
      copyModelEvidence(
        join(ROOT, modelPath),
        join(DIRECTORY, 'failed-reports', modelPath)
      );
      preserveInterruptedModels(
        join(ROOT, task.replace('@', '')),
        join(DIRECTORY, 'failed-reports', modelPath)
      );
    }
    const report = reportTask(result.taskId);
    if (!report) continue;
    const relative = join(
      report.packageDir,
      '.cache/harness-report',
      report.bucket
    );
    if (existsSync(join(ROOT, relative)))
      cpSync(
        join(ROOT, relative),
        join(DIRECTORY, 'failed-reports', relative),
        { recursive: true }
      );
  }
}

if (import.meta.main) process.exit(await runShard(Number(process.argv[2])));

function applyPlanContext(env: NodeJS.ProcessEnv): void {
  const context = JSON.parse(
    readFileSync(join(DIRECTORY, 'context.json'), 'utf8')
  ) as { secretsRange: string; platformKey: string };
  env[SECRETS_RANGE_ENV] = context.secretsRange;
  const platform = JSON.parse(context.platformKey) as {
    platform: string;
    arch: string;
    bun: string;
  };
  if (
    platform.platform !== process.platform ||
    platform.arch !== process.arch ||
    platform.bun !== Bun.version
  )
    throw new Error(
      'Platform or Bun version differs from immutable Verify plan'
    );
  if (env['BUN_CHROME_PATH']) {
    writePlatformCacheKey();
    if (
      readFileSync(join(ROOT, 'turbo-platform-key.json'), 'utf8') !==
      context.platformKey
    )
      throw new Error(
        'Renderer/platform differs from plan; install the pinned Chrome and Bun versions'
      );
  }
  writeFileSync(join(ROOT, 'turbo-platform-key.json'), context.platformKey);
}
