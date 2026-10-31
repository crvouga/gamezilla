// @io-wall-ok — shard process entry adapter.
import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { killProcessTree } from './kill-process-tree';
import { createRunnerResourceDiagnostics } from './runner-resource-io';
import { dryRunPlan, resolveTurboCacheDir } from './turbo-preflight';
import { resolveRunDeadlineSeconds } from './verify-budget';
import type { StopReason, StreamSnapshot } from './verify-shard-diagnosis';
import { redactSecrets, taskStream } from './verify-shard-stream';
import type { VerifyPlan } from './verify-shards';

const ROOT = join(import.meta.dirname, '../../..');

export type ShardExecution = {
  readonly status: number;
  /** Why the shard was killed, or null when Turbo ended it on its own. */
  readonly stop: StopReason | null;
  readonly stream: StreamSnapshot;
};

/** Said the moment the shard is killed, so it is the loudest line in the log. */
function alarm(title: string, running: StreamSnapshot['running']): string {
  const bar = '!'.repeat(78);
  return [
    '',
    bar,
    `!!!  ${title}`,
    ...running.map(
      (task) =>
        `!!!    still running: ${task.taskId} (${task.seconds.toFixed(0)}s)`
    ),
    '!!!  A full diagnosis follows at the end of this shard.',
    bar,
    '',
  ].join('\n');
}

function spawnTurbo(
  ids: readonly string[],
  env: NodeJS.ProcessEnv,
  cold: boolean
): ChildProcess {
  return spawn(
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
    {
      cwd: ROOT,
      env,
      // A process group lets killProcessTree reach detached task workers on
      // POSIX. Windows has no process groups (taskkill /T walks the tree), and
      // a detached child there loses its console, so every task turbo starts
      // would allocate a console window of its own.
      detached: process.platform !== 'win32',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
}

/** The loudest lines in the shard log, said as the shard is killed. */
function announceDeadline(
  deadline: number,
  running: StreamSnapshot['running']
): void {
  console.error(
    alarm(
      `SHARD DEADLINE EXCEEDED: ${deadline}s elapsed. KILLING THE SHARD. This is a timeout, not a test failure.`,
      running
    )
  );
  console.error(
    `::error title=Verify shard out of time::The shard hit its ${deadline}s deadline and was killed. Still running: ${running.map((task) => task.taskId).join(', ') || 'nothing'}`
  );
}

/**
 * One Turbo process over `ids`. It is killed when the shard's deadline runs
 * out, or as soon as a task outruns its own budget; `executeShard` decides
 * what runs after.
 */
function executePass(
  ids: readonly string[],
  env: NodeJS.ProcessEnv,
  tasks: VerifyPlan['tasks'],
  deadline: { readonly remaining: number; readonly total: number }
): Promise<ShardExecution> {
  const cacheDir = resolveTurboCacheDir(ROOT, env);
  const cold = env['VERIFY_CACHE_MODE'] === 'cold';
  verifyExecution(ids, tasks, env);
  const resources = createRunnerResourceDiagnostics((line) =>
    console.log(redactSecrets(line, env))
  );
  resources('start');
  const child = spawnTurbo(ids, env, cold);
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
  let stopReason: StopReason | null = null;
  const stop = () => {
    if (child.pid !== undefined) killProcessTree(child.pid, 'SIGKILL');
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const timer = setTimeout(() => {
    timedOut = true;
    stopReason = { kind: 'shard-deadline', deadlineSeconds: deadline.total };
    announceDeadline(deadline.total, output.snapshot().running);
    resources('shard-timeout');
    stop();
  }, deadline.remaining * 1000);
  const monitor = setInterval(() => {
    const overBudget = output.tick();
    if (overBudget.length) {
      timedOut = true;
      stopReason ??= { kind: 'task-budget' };
      console.error(
        alarm(
          `TASK TIME BUDGET EXCEEDED: ${overBudget.join(', ')}. KILLING THE SHARD.`,
          output.snapshot().running
        )
      );
      resources('task-timeout');
      stop();
    }
  }, 1000);
  const heartbeat = setInterval(() => {
    output.heartbeat();
    resources('heartbeat');
  }, 30_000);
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
      resolve({ status: 1, stop: stopReason, stream: output.snapshot() });
    });
    child.on('close', (code) => {
      cleanup();
      resolve({
        status: timedOut ? 124 : (code ?? 1),
        stop: stopReason,
        stream: output.snapshot(),
      });
    });
  });
}

/**
 * The tasks still worth running once `settled` tasks were killed or failed:
 * every task that neither is one of them nor needs one of them, directly or
 * through another task. A task that needs a settled one would run it again,
 * and neither a killed nor a failed task is ever cached.
 */
export function tasksAfterSettled(
  ids: readonly string[],
  tasks: VerifyPlan['tasks'],
  settled: readonly string[]
): string[] {
  const dependencies = new Map(
    tasks.map((task) => [task.taskId, task.dependencies])
  );
  const killed = new Set(settled);
  const reaches = new Map<string, boolean>();
  const needsKilled = (id: string, path: ReadonlySet<string>): boolean => {
    const known = reaches.get(id);
    if (known !== undefined) return known;
    if (killed.has(id)) return true;
    if (path.has(id)) return false;
    const next = new Set(path).add(id);
    const result = (dependencies.get(id) ?? []).some((dependency) =>
      needsKilled(dependency, next)
    );
    reaches.set(id, result);
    return result;
  };
  return ids.filter((id) => !needsKilled(id, new Set()));
}

const LEFTOVER_PASS_MIN_SECONDS = 30;

/**
 * Runs a shard's tasks, and keeps going past a task that outruns its budget.
 * Killing that task kills the whole Turbo process, so the tasks queued behind
 * it would never run and never reach the remote cache: the next run would pay
 * for them again. The shard stays red (the over-budget task is reported and
 * fails it), but Turbo starts again over what can still pass, inside the
 * shard's own deadline. A task finished in an earlier pass is a cache hit in
 * the next. A shard that hits its deadline or is cancelled stops for good.
 */
export async function executeShard(
  ids: readonly string[],
  env: NodeJS.ProcessEnv,
  tasks: VerifyPlan['tasks']
): Promise<ShardExecution> {
  const cacheDir = resolveTurboCacheDir(ROOT, env);
  if (env['VERIFY_CACHE_MODE'] === 'cold')
    for (const task of tasks.filter((task) => ids.includes(task.taskId)))
      for (const suffix of ['.tar.zst', '-meta.json'])
        rmSync(join(cacheDir, `${task.hash}${suffix}`), { force: true });
  const deadline = resolveRunDeadlineSeconds(env, {
    isDeploy: false,
    slowRunner: true,
  });
  const started = process.hrtime.bigint();
  const elapsed = () => Number(process.hrtime.bigint() - started) / 1e9;
  const finished = new Map<string, StreamSnapshot['finished'][number]>();
  const failed = new Map<string, StreamSnapshot['failed'][number]>();
  const overBudget = new Map<string, StreamSnapshot['overBudget'][number]>();
  let pending = [...ids];
  let budgetKilled = false;
  for (;;) {
    const pass = await executePass(pending, env, tasks, {
      remaining: deadline - elapsed(),
      total: deadline,
    });
    for (const task of pass.stream.finished) finished.set(task.taskId, task);
    for (const task of pass.stream.failed) failed.set(task.taskId, task);
    for (const task of pass.stream.overBudget)
      overBudget.set(task.taskId, task);
    budgetKilled ||= pass.stop?.kind === 'task-budget';
    const next =
      pass.stop?.kind === 'task-budget'
        ? tasksAfterSettled(pending, tasks, [
            ...overBudget.keys(),
            ...failed.keys(),
          ])
        : [];
    if (next.length === 0 || deadline - elapsed() < LEFTOVER_PASS_MIN_SECONDS)
      return {
        status: budgetKilled && pass.status === 0 ? 124 : pass.status,
        stop: pass.stop ?? (budgetKilled ? { kind: 'task-budget' } : null),
        stream: {
          running: pass.stream.running,
          finished: [...finished.values()],
          failed: [...failed.values()],
          overBudget: [...overBudget.values()],
        },
      };
    console.error(
      `Continuing the shard past ${[...overBudget.keys()].join(', ')}: ${next.length} task(s) can still pass and be cached. The shard stays red.`
    );
    pending = next;
  }
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
