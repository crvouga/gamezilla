// @io-wall-ok — isolated CI shard process composition root.

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { reportTask } from '@libs/harness/report-ready';
import { readLatestRunSummary } from './check-budget';
import { preserveInterruptedReports } from './check-interrupted-reports';
import { copyModelEvidence } from './check-model-evidence';
import { packPlan } from './check-plan-transfer';
import { executeShard } from './check-shard-process';
import type { Result } from './check-shard-results';
import { collectResults } from './check-shard-results';
import { redactSecrets } from './check-shard-stream';
import type { CheckPlan } from './check-shards';
import { validatePlan } from './check-shards';
import { prepareStage, stageCachePaths } from './check-stage-cache';
import { SECRETS_RANGE_ENV } from './secrets-scan-range';
import { turboChildEnv, writePlatformCacheKey } from './turbo-ci-run';

const ROOT = join(import.meta.dirname, '../../..');
const DIRECTORY = join(ROOT, '.cache/check-ci');

export async function runShard(index: number): Promise<number> {
  const start = process.hrtime.bigint();
  const plan = JSON.parse(
    readFileSync(join(DIRECTORY, 'plan.json'), 'utf8')
  ) as CheckPlan;
  validatePlan(plan);
  const shard = plan.shards[index];
  if (!shard) throw new Error(`Unknown shard ${index}`);
  const env = turboChildEnv();
  applyPlanContext(env);
  const misses = shard.tasks.filter((task) => !task.hit);
  const prefetchStart = process.hrtime.bigint();
  const { dependencies } = await prepareStage(plan, shard, env, ROOT);
  const needed = new Set(dependencies.map((task) => task.taskId));
  const execute = misses.map((task) => task.taskId);
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
    status,
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
    preserveInterruptedReports(ROOT, results);
    preserveFailedReports(results);
    packEvidence(index, failed);
  } catch (error) {
    console.error(
      redactSecrets(`Evidence transfer unavailable: ${String(error)}`, env)
    );
    throw error;
  }
}

function packEvidence(index: number, failed: boolean): void {
  const paths = [`.cache/check-ci/results/shard-${index}.json`];
  const plan = JSON.parse(
    readFileSync(join(DIRECTORY, 'plan.json'), 'utf8')
  ) as CheckPlan;
  paths.push(...stageCachePaths(plan, plan.shards[index]!, ROOT, failed));
  if (plan.shards[index]!.stage === 'prerequisites') {
    writeFileSync(join(DIRECTORY, 'plan.payload'), packPlan());
    paths.push('.cache/check-ci/plan.payload');
  }
  if (existsSync(join(DIRECTORY, 'failed-reports')))
    paths.push('.cache/check-ci/failed-reports');
  const packed = spawnSync('tar', [
    '-cf',
    join(DIRECTORY, `evidence-${index}.tar`),
    '-C',
    ROOT,
    ...paths,
  ]);
  if (packed.status !== 0) throw new Error('Cannot transfer shard evidence');
}

function preserveFailedReports(results: readonly Result[]): void {
  for (const result of results.filter((task) => !task.passed)) {
    if (
      result.taskId.endsWith('#check:models') ||
      result.taskId === '@apps/product#test:contract'
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
      'Platform or Bun version differs from immutable Check plan'
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
