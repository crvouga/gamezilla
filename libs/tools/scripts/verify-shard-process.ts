// @io-wall-ok — shard process entry adapter.
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { killProcessTree } from './kill-process-tree';
import { dryRunPlan, resolveTurboCacheDir } from './turbo-preflight';
import { resolveRunDeadlineSeconds } from './verify-budget';
import { redactSecrets, taskStream } from './verify-shard-stream';
import type { VerifyPlan } from './verify-shards';

const ROOT = join(import.meta.dirname, '../../..');

export function executeShard(
  ids: readonly string[],
  env: NodeJS.ProcessEnv,
  tasks: VerifyPlan['tasks']
): Promise<number> {
  const cacheDir = resolveTurboCacheDir(ROOT, env);
  const cold = env['VERIFY_CACHE_MODE'] === 'cold';
  if (cold)
    for (const task of tasks.filter((task) => ids.includes(task.taskId)))
      for (const suffix of ['.tar.zst', '-meta.json'])
        rmSync(join(cacheDir, `${task.hash}${suffix}`), { force: true });
  verifyExecution(ids, tasks, env);
  const child = spawn(
    'turbo',
    [
      'run',
      ...ids,
      '--framework-inference=false',
      cold ? '--cache=local:rw,remote:w' : '--cache=local:rw,remote:rw',
      `--concurrency=${env['TURBO_CONCURRENCY'] ?? '16'}`,
      '--cache-workers=32',
      '--summarize',
      '--json',
      '--output-logs=full',
      '--continue=dependencies-successful',
    ],
    { cwd: ROOT, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const output = taskStream(
    tasks,
    (line) => console.log(redactSecrets(line, env)),
    {
      now: () => Number(process.hrtime.bigint()) / 1e6,
      completed: (task) =>
        existsSync(join(cacheDir, `${task.hash}-meta.json`)) &&
        existsSync(join(cacheDir, `${task.hash}.tar.zst`)),
    }
  );
  createInterface({ input: child.stdout! }).on('line', output);
  createInterface({ input: child.stderr! }).on('line', (line) =>
    console.error(redactSecrets(line, env))
  );
  let timedOut = false;
  const stop = () => {
    if (child.pid !== undefined) killProcessTree(child.pid, 'SIGKILL');
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const deadline = resolveRunDeadlineSeconds(env, {
    isDeploy: false,
    slowRunner: true,
  });
  const timer = setTimeout(() => {
    timedOut = true;
    output.heartbeat();
    console.error(`Verify shard deadline exceeded (${deadline}s)`);
    stop();
  }, deadline * 1000);
  const monitor = setInterval(() => {
    if (output.tick().length) {
      timedOut = true;
      stop();
    }
  }, 1000);
  const heartbeat = setInterval(output.heartbeat, 30_000);
  const cleanup = () => {
    clearTimeout(timer);
    clearInterval(monitor);
    clearInterval(heartbeat);
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    output.tick();
  };
  return new Promise((resolve) => {
    child.on('error', (error) => {
      console.error(error);
      cleanup();
      resolve(1);
    });
    child.on('close', (code) => {
      cleanup();
      resolve(timedOut ? 124 : (code ?? 1));
    });
  });
}

function verifyExecution(
  ids: readonly string[],
  tasks: VerifyPlan['tasks'],
  env: NodeJS.ProcessEnv
): void {
  const dry = dryRunPlan(
    ['run', ...ids, '--framework-inference=false', '--cache=local:rw'],
    ROOT,
    env
  );
  const expected = new Map(tasks.map((task) => [task.taskId, task]));
  for (const task of dry.tasks) {
    const planned = expected.get(task.taskId);
    if (!planned || planned.hash !== task.hash)
      throw new Error(
        `Task hash changed since planning: ${task.taskId}; compare inputs, declared env and platform key`
      );
    if (!ids.includes(task.taskId) && !task.hit)
      throw new Error(
        `Prerequisite cache missing: ${task.taskId}; refusing to execute outside assignment`
      );
  }
}
