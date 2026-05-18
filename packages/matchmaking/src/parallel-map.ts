/**
 * Bounded-concurrency Promise.all. Runs `worker(item, index)` for each
 * input in parallel up to `limit` simultaneous in-flight tasks.
 * Preserves input order in the result array. Aborts cleanly when
 * `signal` is supplied and flips to aborted between tasks — lanes
 * that haven't started yet exit immediately and leave their result
 * slot `undefined` (callers must handle that case).
 *
 * Used by the per-partition fan-out drains in `matchmaker.ts`. Lives
 * in its own file so `matchmaker.ts` stays under the file size cap.
 *
 * @internal
 */
export async function parallelMap<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> {
  const cap = Math.max(1, Math.floor(limit));
  const out = new Array<R>(items.length);
  let next = 0;
  async function lane(): Promise<void> {
    while (true) {
      if (signal?.aborted === true) return;
      const i = next;
      next += 1;
      if (i >= items.length) return;
      const item = items[i] as T;
      out[i] = await worker(item, i);
    }
  }
  const lanes: Promise<void>[] = [];
  const n = Math.min(cap, items.length);
  for (let i = 0; i < n; i += 1) lanes.push(lane());
  await Promise.all(lanes);
  return out;
}
