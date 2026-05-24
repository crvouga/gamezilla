import type { NdjsonErrorFrame, NdjsonFrame } from '../shared/frames';

/**
 * Maps a thrown error from one indexed work unit to a wire-level
 * {@link NdjsonErrorFrame}. The caller controls status, message, kind,
 * and context so domain-specific failures (auth rejection, crash with
 * structured context, …) round-trip without leaking through generic
 * 500 frames.
 */
export type NdjsonErrorMapper = (
  index: number,
  error: unknown
) => NdjsonErrorFrame;

/**
 * Issue every indexed work unit in parallel and yield NDJSON frames in
 * completion order, terminating with a single `end` frame.
 *
 * Per-item errors become inline `error` frames (built via {@link mapError})
 * so a slow / forbidden item never blocks faster siblings sharing the same
 * request. The stream still completes with `end` even when every item
 * fails — clients rely on `end` to differentiate a graceful close from a
 * truncated transport.
 */
export async function* streamParallelIndexed<T>(
  count: number,
  runAtIndex: (index: number) => Promise<T>,
  mapError: NdjsonErrorMapper
): AsyncIterable<NdjsonFrame<T>> {
  type Pending = Promise<{
    readonly index: number;
    readonly result?: T;
    readonly error?: unknown;
  }>;
  const pending = new Map<number, Pending>();
  for (let i = 0; i < count; i++) {
    const index = i;
    const p: Pending = runAtIndex(index)
      .then((result) => ({ index, result }))
      .catch((error: unknown) => ({ index, error }));
    pending.set(index, p);
  }
  while (pending.size > 0) {
    const winner = await Promise.race(pending.values());
    pending.delete(winner.index);
    if (winner.error !== undefined) {
      yield mapError(winner.index, winner.error);
      continue;
    }
    if (winner.result === undefined) continue;
    yield {
      frame: 'result',
      index: winner.index,
      result: winner.result,
    };
  }
  yield { frame: 'end' };
}
