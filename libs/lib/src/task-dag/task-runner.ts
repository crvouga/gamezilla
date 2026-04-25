import type { ITask, ITaskRunner, TaskWrapper } from './interface';
import type { Task } from './task';

export interface TaskRunnerOptions {
  wrap?: TaskWrapper;
}

type TaskError = { id: string; error: unknown };

export class TaskRunner implements ITaskRunner {
  private readonly wrap: TaskWrapper | undefined;

  constructor(opts?: TaskRunnerOptions) {
    this.wrap = opts?.wrap;
  }

  async run(tasks: Iterable<ITask<unknown>>): Promise<void> {
    const all = collectTasks(tasks);
    this.validateDeps(all);
    this.detectCycles(all);

    const state: SchedulerState = {
      completed: new Set<string>(),
      failed: new Set<string>(),
      running: new Map<string, Promise<void>>(),
      remaining: new Set(all.keys()),
      errors: [],
    };

    while (state.remaining.size > 0 || state.running.size > 0) {
      this.skipFailedDescendants(all, state);
      this.launchReadyTasks(all, state);
      if (state.running.size === 0) break;
      await Promise.race(state.running.values());
    }

    if (state.errors.length > 0) {
      await Promise.allSettled(state.running.values());
      throwAggregateOrSingle(state.errors);
    }
  }

  private skipFailedDescendants(
    all: Map<string, Task<unknown>>,
    state: SchedulerState
  ): void {
    const toSkip: string[] = [];
    for (const id of state.remaining) {
      if (hasFailedDep(all, id, state.failed)) toSkip.push(id);
    }
    for (const id of toSkip) {
      state.remaining.delete(id);
      state.failed.add(id);
    }
  }

  private launchReadyTasks(
    all: Map<string, Task<unknown>>,
    state: SchedulerState
  ): void {
    const launched: string[] = [];
    for (const id of state.remaining) {
      if (!isReady(all, id, state.completed)) continue;
      launched.push(id);
      state.running.set(id, this.executeTask(all.get(id)!, id, state));
    }
    for (const id of launched) state.remaining.delete(id);
  }

  private executeTask(
    task: Task<unknown>,
    id: string,
    state: SchedulerState
  ): Promise<void> {
    return task
      .execute(this.wrap)
      .then(() => {
        state.completed.add(id);
      })
      .catch((e: unknown) => {
        state.failed.add(id);
        state.errors.push({ id, error: e });
      })
      .finally(() => {
        state.running.delete(id);
      });
  }

  private validateDeps(all: Map<string, Task<unknown>>): void {
    for (const [id, task] of all) {
      for (const dep of task.deps) {
        if (!all.has(dep.id)) {
          throw new Error(
            `Task "${id}" depends on "${dep.id}" which is not in the task set`
          );
        }
      }
    }
  }

  private detectCycles(all: Map<string, Task<unknown>>): void {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    for (const id of all.keys()) color.set(id, WHITE);

    const visit = (id: string, path: string[]): void => {
      color.set(id, GRAY);
      const task = all.get(id)!;
      for (const dep of task.deps) {
        const c = color.get(dep.id)!;
        if (c === GRAY) {
          const cycle = [...path.slice(path.indexOf(dep.id)), dep.id];
          throw new Error(`Cycle detected: ${cycle.join(' → ')}`);
        }
        if (c === WHITE) {
          visit(dep.id, [...path, dep.id]);
        }
      }
      color.set(id, BLACK);
    };

    for (const id of all.keys()) {
      if (color.get(id) === WHITE) visit(id, [id]);
    }
  }
}

type SchedulerState = {
  completed: Set<string>;
  failed: Set<string>;
  running: Map<string, Promise<void>>;
  remaining: Set<string>;
  errors: TaskError[];
};

function collectTasks(
  tasks: Iterable<ITask<unknown>>
): Map<string, Task<unknown>> {
  const all = new Map<string, Task<unknown>>();
  for (const t of tasks) {
    if (all.has(t.id)) {
      throw new Error(`Duplicate task id: "${t.id}"`);
    }
    all.set(t.id, t as Task<unknown>);
  }
  return all;
}

function isReady(
  all: Map<string, Task<unknown>>,
  id: string,
  completed: Set<string>
): boolean {
  const task = all.get(id)!;
  for (const dep of task.deps) {
    if (!completed.has(dep.id)) return false;
  }
  return true;
}

function hasFailedDep(
  all: Map<string, Task<unknown>>,
  id: string,
  failed: Set<string>
): boolean {
  const task = all.get(id)!;
  for (const dep of task.deps) {
    if (failed.has(dep.id)) return true;
  }
  return false;
}

function throwAggregateOrSingle(errors: TaskError[]): never {
  if (errors.length === 1) {
    const e = errors[0]!.error;
    throw e instanceof Error ? e : new Error(String(e));
  }
  throw new AggregateError(
    errors.map((e) =>
      e.error instanceof Error ? e.error : new Error(String(e.error))
    ),
    `${errors.length} task(s) failed: ${errors.map((e) => e.id).join(', ')}`
  );
}
