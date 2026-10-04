/**
 * Query-response checkpoint format: `${epochMs}${seq padded to 6 digits}`.
 * Compared as BigInt on the client (`compareCheckpoint`).
 */
export function formatCheckpoint(nowMs: number, seq: number): string {
  return `${nowMs}${String(seq).padStart(6, '0')}`;
}

export type MonotonicCheckpointOpts = {
  /**
   * High-water mark from a prior allocator (e.g. before harness server remake).
   * Ensures new checkpoints stay strictly above anything clients already stored
   * while the previous process ran with a fast/skewed clock.
   */
  readonly initialLast?: bigint;
};

export type MonotonicCheckpoint = {
  readonly next: () => string;
  /** Highest value already issued (0n if none). */
  readonly highWater: () => bigint;
};

/**
 * Allocate strictly increasing query checkpoints.
 *
 * Wall clock can jump backwards (NTP, harness `skewClock(-60_000)`). Embedding
 * `now()` alone would then emit a checkpoint ≤ the client's `last_checkpoint`,
 * and merge would drop every snapshot as stale forever.
 *
 * Process remake after a *forward* skew has the opposite problem: clients hold
 * high checkpoints, and a fresh allocator with corrected `now()` would mint
 * lower ones — pass {@link MonotonicCheckpointOpts.initialLast} from the
 * prior allocator's {@link MonotonicCheckpoint.highWater}.
 */
export function createMonotonicCheckpoint(
  now: () => number,
  opts?: MonotonicCheckpointOpts
): MonotonicCheckpoint {
  let seq = 0;
  let last = opts?.initialLast ?? 0n;
  return {
    next: () => {
      seq += 1;
      const candidate = BigInt(formatCheckpoint(now(), seq));
      last = candidate > last ? candidate : last + 1n;
      return last.toString();
    },
    highWater: () => last,
  };
}
