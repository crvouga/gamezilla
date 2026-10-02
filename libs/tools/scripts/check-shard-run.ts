// @io-wall-ok — isolated CI shard process composition root.
import { spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { reportTask } from '@libs/harness/ci/report-ready';
import {
  findBudgetOverruns,
  formatBudgetOverruns,
  readLatestRunSummary,
} from './check-budget';
import { redactSecrets, taskStream } from './check-shard-stream';
import {
  type CheckPlan,
  validatePlan,
  validateShardResult,
} from './check-shards';
import { SECRETS_RANGE_ENV } from './secrets-scan-range';
import { turboChildEnv, writePlatformCacheKey } from './turbo-ci-run';
import { prefetchRemoteHits } from './turbo-preflight';

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
  const context = JSON.parse(
    readFileSync(join(DIRECTORY, 'context.json'), 'utf8')
  ) as { secretsRange: string };
  env[SECRETS_RANGE_ENV] = context.secretsRange;
  writePlatformCacheKey();
  const misses = shard.tasks.filter((task) => !task.hit);
  const needed = new Set(misses.flatMap((task) => task.dependencies));
  for (const id of needed) {
    const task = shard.tasks.find((task) => task.taskId === id);
    for (const dep of task?.dependencies ?? []) needed.add(dep);
  }
  const restore = shard.tasks.filter(
    (task) => task.hit && needed.has(task.taskId)
  );
  const prefetchStart = process.hrtime.bigint();
  await prefetchRemoteHits(
    {
      tasks: shard.tasks,
      toExecute: misses,
      remoteHits: restore.filter((task) => task.source === 'REMOTE'),
    },
    ROOT,
    env
  );
  const prefetchMs = Number(process.hrtime.bigint() - prefetchStart) / 1e6;
  const executionStart = process.hrtime.bigint();
  const status = misses.length
    ? await execute(
        misses.map((task) => task.taskId),
        env,
        shard.tasks
      )
    : 0;
  const executionMs = Number(process.hrtime.bigint() - executionStart) / 1e6;
  const summary = misses.length ? readLatestRunSummary(ROOT) : null;
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
  preserveFailedReports(results);
  console.log(
    `shard ${index}: ${shard.tasks.length} tasks; estimated ${shard.seconds.toFixed(1)} task-seconds; actual ${(actualMs / 1000).toFixed(3)}s; ${result.hits} hits; ${misses.length} planned misses; prefetch ${prefetchMs.toFixed(0)}ms`
  );
  return verdict;
}

function preserveFailedReports(results: readonly Result[]): void {
  for (const result of results.filter((task) => !task.passed)) {
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

type Result = {
  taskId: string;
  hash: string;
  passed: boolean;
  cache: string;
  milliseconds: number;
  exitCode: number;
};
function collectResults(args: {
  plan: CheckPlan;
  shard: CheckPlan['shards'][number];
  summary: ReturnType<typeof readLatestRunSummary>;
  needed: ReadonlySet<string>;
  status: number;
  env: NodeJS.ProcessEnv;
}): { results: Result[]; verdict: number } {
  const { plan, shard, summary, needed, status, env } = args;
  const results: Result[] = shard.tasks
    .filter((task) => task.hit && !needed.has(task.taskId))
    .map((task) => ({
      taskId: task.taskId,
      hash: task.hash,
      passed: true,
      cache: 'HIT',
      milliseconds: 0,
      exitCode: 0,
    }));
  for (const item of summary?.tasks ?? []) {
    const task = item as {
      taskId: string;
      hash: string;
      cache: { status: string };
      execution?: { exitCode: number; startTime: number; endTime: number };
    };
    const milliseconds = task.execution
      ? task.execution.endTime - task.execution.startTime
      : 0;
    const passed =
      task.cache.status === 'HIT' || task.execution?.exitCode === 0;
    // Transit nodes have no command, output or verdict.
    if (!shard.tasks.some((expected) => expected.taskId === task.taskId)) {
      if (plan.tasks.some((expected) => expected.taskId === task.taskId))
        throw new Error(`Unexpected execution: ${task.taskId}`);
      continue;
    }
    results.push({
      taskId: task.taskId,
      hash: task.hash,
      passed,
      cache: task.cache.status,
      milliseconds,
      exitCode: task.execution?.exitCode ?? (passed ? 0 : 1),
    });
    if (!passed)
      console.error(
        redactSecrets(
          `FAILED ${task.taskId}; command: ${shard.tasks.find((t) => t.taskId === task.taskId)!.command}; exit code ${task.execution?.exitCode ?? 'missing'}; elapsed ${(milliseconds / 1000).toFixed(3)}s`,
          env
        )
      );
  }
  let verdict = status;
  try {
    validateShardResult(shard, results);
  } catch (error) {
    console.error(error);
    verdict = 1;
  }
  if (summary) {
    const overruns = findBudgetOverruns(summary, true);
    if (overruns.length) {
      console.error(formatBudgetOverruns(overruns));
      verdict = 1;
    }
  }
  return { results, verdict };
}

function execute(
  ids: readonly string[],
  env: NodeJS.ProcessEnv,
  tasks: CheckPlan['tasks']
): Promise<number> {
  const child = spawn(
    'turbo',
    [
      'run',
      ...ids,
      '--framework-inference=false',
      env['CHECK_CACHE_MODE'] === 'cold'
        ? '--cache=local:w,remote:w'
        : '--cache=local:rw,remote:rw',
      `--concurrency=${env['TURBO_CONCURRENCY'] ?? '16'}`,
      '--cache-workers=32',
      '--summarize',
      '--json',
      '--output-logs=full',
      '--continue=dependencies-successful',
    ],
    { cwd: ROOT, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const output = taskStream(tasks, (line) =>
    console.log(redactSecrets(line, env))
  );
  createInterface({ input: child.stdout! }).on('line', output);
  createInterface({ input: child.stderr! }).on('line', (line) =>
    console.error(redactSecrets(line, env))
  );
  const stop = () => {
    try {
      process.kill(-child.pid!, 'SIGTERM');
    } catch {}
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const timer = setTimeout(() => {
    console.error('Check shard deadline exceeded (1200s)');
    stop();
  }, 1_200_000);
  return new Promise((resolve) => {
    child.on('error', (error) => {
      console.error(error);
      resolve(1);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      resolve(code ?? 1);
    });
  });
}

if (import.meta.main) process.exit(await runShard(Number(process.argv[2])));
