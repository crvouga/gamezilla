/**
 * Run `tasks` at most `limit` at a time and yield each result the moment it
 * settles, so one slow read never holds back faster siblings. A rejection
 * is rethrown to the consumer once every started task has settled.
 */
export async function* inCompletionOrder<T>(
  tasks: readonly (() => Promise<T>)[],
  limit: number
): AsyncGenerator<T> {
  const width = Math.max(1, Math.floor(limit));
  const running = new Map<number, Promise<{ id: number; value: T }>>();
  let next = 0;
  const outcome: { failure: { error: unknown } | null } = { failure: null };

  const start = (): void => {
    while (
      running.size < width &&
      next < tasks.length &&
      outcome.failure === null
    ) {
      const id = next;
      const task = tasks[id];
      next += 1;
      if (task === undefined) continue;
      running.set(
        id,
        task().then(
          (value) => ({ id, value }),
          (error: unknown) => {
            running.delete(id);
            outcome.failure ??= { error };
            throw error;
          }
        )
      );
    }
  };

  start();
  while (running.size > 0) {
    let settled: { id: number; value: T } | null = null;
    try {
      settled = await Promise.race(running.values());
    } catch {
      // Recorded in `failure`; drain the rest, then rethrow.
      continue;
    }
    running.delete(settled.id);
    if (outcome.failure === null) yield settled.value;
    start();
  }
  if (outcome.failure !== null) throw outcome.failure.error;
}

/** Apply `work` to every item, at most `limit` at a time. */
export async function eachLimited<T>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<void>
): Promise<void> {
  const tasks = items.map((item) => () => work(item));
  for await (const _ of inCompletionOrder(tasks, limit)) {
    // Results are void; draining is the point.
  }
}

/** Consume a lazy input with backpressure, draining started work before failure. */
export async function eachLimitedStream<T>(
  items: AsyncIterable<T>,
  limit: number,
  work: (item: T) => Promise<void>
): Promise<void> {
  const width = Math.max(1, Math.floor(limit));
  const running = new Set<Promise<void>>();
  const outcome: { failure: { error: unknown } | null } = { failure: null };
  try {
    for await (const item of items) {
      if (outcome.failure !== null) break;
      const task: Promise<void> = work(item)
        .catch((error: unknown) => {
          outcome.failure ??= { error };
        })
        .finally(() => running.delete(task));
      running.add(task);
      if (running.size >= width) await Promise.race(running);
    }
  } finally {
    await Promise.all(running);
  }
  if (outcome.failure !== null) throw outcome.failure.error;
}
