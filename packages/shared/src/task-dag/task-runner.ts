import type { ITask, ITaskRunner, TaskWrapper } from './interface';
import type { Task } from './task';

export interface TaskRunnerOptions {
  wrap?: TaskWrapper;
}

export class TaskRunner implements ITaskRunner {
  private readonly wrap: TaskWrapper | undefined;

  constructor(opts?: TaskRunnerOptions) {
    this.wrap = opts?.wrap;
  }

  async run(tasks: Iterable<ITask<unknown>>): Promise<void> {
    const all = new Map<string, Task<unknown>>();
    for (const t of tasks) {
      if (all.has(t.id)) {
        throw new Error(`Duplicate task id: "${t.id}"`);
      }
      all.set(t.id, t as Task<unknown>);
    }

    this.validateDeps(all);
    this.detectCycles(all);

    const completed = new Set<string>();
    const failed = new Set<string>();
    const running = new Map<string, Promise<void>>();
    const remaining = new Set(all.keys());
    const errors: { id: string; error: unknown }[] = [];

    const isReady = (id: string): boolean => {
      const task = all.get(id)!;
      for (const dep of task.deps) {
        if (!completed.has(dep.id)) return false;
      }
      return true;
    };

    const hasFailedDep = (id: string): boolean => {
      const task = all.get(id)!;
      for (const dep of task.deps) {
        if (failed.has(dep.id)) return true;
      }
      return false;
    };

    while (remaining.size > 0 || running.size > 0) {
      const toSkip: string[] = [];
      for (const id of remaining) {
        if (hasFailedDep(id)) toSkip.push(id);
      }
      for (const id of toSkip) {
        remaining.delete(id);
        failed.add(id);
      }

      const launched: string[] = [];
      for (const id of remaining) {
        if (isReady(id)) {
          launched.push(id);
          const task = all.get(id)!;
          const p = task
            .execute(this.wrap)
            .then(() => {
              completed.add(id);
            })
            .catch((e: unknown) => {
              failed.add(id);
              errors.push({ id, error: e });
            })
            .finally(() => {
              running.delete(id);
            });
          running.set(id, p);
        }
      }
      for (const id of launched) {
        remaining.delete(id);
      }

      if (running.size === 0) break;

      await Promise.race(running.values());
    }

    if (errors.length > 0) {
      await Promise.allSettled(running.values());

      if (errors.length === 1) {
        const e = errors[0]!.error;
        throw e instanceof Error ? e : new Error(String(e));
      }
      throw new AggregateError(
        errors.map((e) =>
          e.error instanceof Error ? e.error : new Error(String(e.error)),
        ),
        `${errors.length} task(s) failed: ${errors.map((e) => e.id).join(', ')}`,
      );
    }
  }

  private validateDeps(all: Map<string, Task<unknown>>): void {
    for (const [id, task] of all) {
      for (const dep of task.deps) {
        if (!all.has(dep.id)) {
          throw new Error(
            `Task "${id}" depends on "${dep.id}" which is not in the task set`,
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
      if (color.get(id) === WHITE) {
        visit(id, [id]);
      }
    }
  }
}
