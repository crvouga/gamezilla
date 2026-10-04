/**
 * Bounded-concurrency Promise.all. Preserves input order in the result array.
 */
export async function parallelMap<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const cap = Math.max(1, Math.floor(limit));
  const out = new Array<R>(items.length);
  let next = 0;
  async function lane(): Promise<void> {
    while (true) {
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
