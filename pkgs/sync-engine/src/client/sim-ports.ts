/**
 * Injectable nondeterminism boundaries for deterministic simulation.
 * Production defaults to wall clock / Math.random / real timers.
 */

export type Timers = {
  readonly setTimeout: (fn: () => void, ms: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
};

export type SyncClock = {
  /** Epoch milliseconds (virtual or wall). */
  readonly now: () => number;
};

export type SyncRandom = {
  /** Uniform float in [0, 1). */
  readonly random: () => number;
};

/** Stable id mint for mutations / rejection rows. */
export type CreateId = () => string;

export const REAL_TIMERS: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  },
};

export function resolveTimers(override?: Timers): Timers {
  return override ?? REAL_TIMERS;
}

export function resolveNow(override?: () => number): () => number {
  return override ?? Date.now;
}

export function resolveRandom(override?: () => number): () => number {
  return override ?? Math.random;
}

export function resolveCreateId(override?: CreateId): CreateId {
  return override ?? (() => crypto.randomUUID());
}
