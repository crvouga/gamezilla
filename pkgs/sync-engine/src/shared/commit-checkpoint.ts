/**
 * Query-response checkpoint format: `${epochMs}${seq padded to 6 digits}`.
 * Compared as BigInt on the client (`compareCheckpoint`).
 */
export function formatCheckpoint(nowMs: number, seq: number): string {
  return `${nowMs}${String(seq).padStart(6, '0')}`;
}

/**
 * Allocate strictly increasing query checkpoints.
 *
 * Wall clock can jump backwards (NTP, sim `skewClock(-60_000)`). Embedding
 * `now()` alone would then emit a checkpoint ≤ the client's `last_checkpoint`,
 * and merge would drop every snapshot as stale forever.
 */
export function createMonotonicCheckpoint(now: () => number): () => string {
  let seq = 0;
  let last = 0n;
  return () => {
    seq += 1;
    const candidate = BigInt(formatCheckpoint(now(), seq));
    last = candidate > last ? candidate : last + 1n;
    return last.toString();
  };
}
