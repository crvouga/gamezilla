import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import type { ITask } from '@pkgs/task-dag-shared/interface';
import { Task } from '@pkgs/task-dag-shared/task';
import { TaskRunner } from '@pkgs/task-dag-shared/task-runner';
import fc from 'fast-check';

/** Directed graph over nodes `0..n-1`; `deps[i]` lists what node `i` depends on. */
type Graph = { readonly n: number; readonly deps: readonly number[][] };

/** Any digraph (self-loops and cycles allowed). */
const arbGraph = (): fc.Arbitrary<Graph> =>
  fc.integer({ min: 1, max: 7 }).chain((n) =>
    fc
      .array(fc.uniqueArray(fc.nat({ max: n - 1 }), { maxLength: n }), {
        minLength: n,
        maxLength: n,
      })
      .map((deps) => ({ n, deps }))
  );

/** Acyclic digraph: node `i` only depends on nodes `< i`. */
const arbDag = (): fc.Arbitrary<Graph> =>
  arbGraph().map((g) => ({
    n: g.n,
    deps: g.deps.map((ds, i) => ds.filter((d) => d < i)),
  }));

/** Reference model: Kahn's algorithm — acyclic iff every node gets peeled. */
function hasCycleModel(g: Graph): boolean {
  const remaining = new Set(Array.from({ length: g.n }, (_, i) => i));
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const i of remaining) {
      if (g.deps[i]!.every((d) => !remaining.has(d))) {
        remaining.delete(i);
        progressed = true;
      }
    }
  }
  return remaining.size > 0;
}

/** Transitive dependencies of `i` (excluding `i`), for a DAG. */
function ancestors(g: Graph, i: number): Set<number> {
  const out = new Set<number>();
  const stack = [...g.deps[i]!];
  while (stack.length > 0) {
    const d = stack.pop()!;
    if (out.has(d)) continue;
    out.add(d);
    stack.push(...g.deps[d]!);
  }
  return out;
}

async function yieldTimes(count: number): Promise<void> {
  for (let k = 0; k < count; k++) await Promise.resolve();
}

type Harness = {
  readonly tasks: Task<number>[];
  readonly log: string[];
};

/** Build tasks that log `start:i` / `end:i`, yield `delays[i]` microtasks, and fail when `failing` has them. */
function buildTasks(
  g: Graph,
  delays: readonly number[],
  failing: ReadonlySet<number> = new Set()
): Harness {
  const log: string[] = [];
  const tasks = Array.from(
    { length: g.n },
    (_, i) =>
      new Task<number>(`t${i}`, async () => {
        log.push(`start:${i}`);
        await yieldTimes(delays[i] ?? 0);
        log.push(`end:${i}`);
        if (failing.has(i)) throw new Error(`fail:${i}`);
        return i * 10;
      })
  );
  g.deps.forEach((ds, i) => {
    tasks[i]!.dependsOn(...ds.map((d) => tasks[d]!));
  });
  return { tasks, log };
}

function permute<T>(items: readonly T[], keys: readonly number[]): T[] {
  return items
    .map((item, i) => ({ item, key: keys[i] ?? 0, i }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .map((x) => x.item);
}

const arbDelays = fc.array(fc.nat({ max: 4 }), { minLength: 7, maxLength: 7 });
const arbOrderKeys = fc.array(fc.nat({ max: 100 }), {
  minLength: 7,
  maxLength: 7,
});

describe('TaskRunner properties', () => {
  test('DAG: every task runs exactly once, after all of its deps finished', async () => {
    await assertProperty(
      'topological execution',
      fc.asyncProperty(
        arbDag(),
        arbDelays,
        arbOrderKeys,
        async (g, delays, orderKeys) => {
          const { tasks, log } = buildTasks(g, delays);
          const wrapped: string[] = [];
          const runner = new TaskRunner({
            wrap: (task, fn) => {
              wrapped.push(task.id);
              return fn();
            },
          });
          await runner.run(permute(tasks, orderKeys));

          for (let i = 0; i < g.n; i++) {
            expect(log.filter((e) => e === `start:${i}`)).toHaveLength(1);
            expect(tasks[i]!.result).toBe(i * 10);
            const started = log.indexOf(`start:${i}`);
            for (const d of g.deps[i]!) {
              expect(log.indexOf(`end:${d}`)).toBeLessThan(started);
            }
          }
          expect([...wrapped].sort()).toEqual(tasks.map((t) => t.id).sort());
        }
      )
    );
  });

  test('cycle detected iff the graph has a cycle (Kahn model); nothing runs on a cycle', async () => {
    await assertProperty(
      'cycle detection agrees with model',
      fc.asyncProperty(arbGraph(), arbOrderKeys, async (g, orderKeys) => {
        const { tasks, log } = buildTasks(g, []);
        const outcome = await new TaskRunner()
          .run(permute(tasks, orderKeys))
          .then(
            () => null,
            (e: unknown) => e
          );
        if (hasCycleModel(g)) {
          expect(outcome).toBeInstanceOf(Error);
          expect((outcome as Error).message).toStartWith('Cycle detected: ');
          expect(log).toEqual([]);
        } else {
          expect(outcome).toBeNull();
        }
      })
    );
  });

  test('a task runs iff none of its transitive deps failed; errors match the failing runs', async () => {
    await assertProperty(
      'failure propagation',
      fc.asyncProperty(
        arbDag(),
        arbDelays,
        fc.uniqueArray(fc.nat({ max: 6 }), { maxLength: 3 }),
        async (g, delays, failingRaw) => {
          const failing = new Set(failingRaw.filter((i) => i < g.n));
          const { tasks, log } = buildTasks(g, delays, failing);
          const outcome = await new TaskRunner().run(tasks).then(
            () => null,
            (e: unknown) => e
          );

          const shouldRun = (i: number): boolean =>
            [...ancestors(g, i)].every((a) => !failing.has(a));
          const failedRuns: string[] = [];
          for (let i = 0; i < g.n; i++) {
            const ran = log.includes(`start:${i}`);
            expect(ran).toBe(shouldRun(i));
            if (ran && failing.has(i)) failedRuns.push(`fail:${i}`);
          }

          if (failedRuns.length === 0) {
            expect(outcome).toBeNull();
          } else if (failedRuns.length === 1) {
            expect((outcome as Error).message).toBe(failedRuns[0]!);
          } else {
            expect(outcome).toBeInstanceOf(AggregateError);
            const messages = (outcome as AggregateError).errors.map(
              (e: Error) => e.message
            );
            expect(messages.sort()).toEqual(failedRuns.sort());
          }
        }
      )
    );
  });

  test('a dependency outside the task set is rejected before anything runs', async () => {
    await assertProperty(
      'missing dependency',
      fc.asyncProperty(
        arbDag().filter((g) => g.deps.some((ds) => ds.length > 0)),
        async (g) => {
          const { tasks, log } = buildTasks(g, []);
          const missing = g.deps.flat()[0]!;
          const subset = tasks.filter((_, i) => i !== missing);
          await expect(new TaskRunner().run(subset)).rejects.toThrow(
            'which is not in the task set'
          );
          expect(log).toEqual([]);
        }
      )
    );
  });

  test('duplicate task ids are rejected', async () => {
    await assertProperty(
      'duplicate ids',
      fc.asyncProperty(fc.string({ maxLength: 6 }), async (id) => {
        const a: ITask<unknown> = new Task(id, async () => 1);
        const b: ITask<unknown> = new Task(id, async () => 2);
        await expect(new TaskRunner().run([a, b])).rejects.toThrow(
          `Duplicate task id: "${id}"`
        );
      })
    );
  });
});
