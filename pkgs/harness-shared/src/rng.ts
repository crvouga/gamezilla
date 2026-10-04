import { createSeededRng } from '@pkgs/uuid-shared/seeded-rng';
import type { SeededRng } from '@pkgs/uuid-shared/seeded-rng';

/**
 * Uniform float in [0, 1). The only draw primitive the framework speaks.
 * Forks are independent streams; adding a fork never perturbs siblings.
 */
export type Rng = {
  readonly next: () => number;
  readonly fork: (name: string) => Rng;
};

export function createRng(seed: number | bigint | string): Rng {
  return wrapSeeded(createSeededRng(seed));
}

export function wrapSeeded(seeded: SeededRng): Rng {
  return {
    next: () => seeded.random(),
    fork: (name) => wrapSeeded(seeded.fork(name)),
  };
}

/** Expose the underlying SeededRng for kernel pieces that still need int/bool/pick. */
export function asSeededRng(
  rng: Rng & { readonly _seeded?: SeededRng }
): SeededRng {
  if (rng._seeded !== undefined) return rng._seeded;
  // Reconstruct via recording wrapper path — callers that need SeededRng
  // should pass createRecordingRng / createRng which attach _seeded.
  throw new Error(
    'Rng: no SeededRng backing; use createRng / recording wrappers'
  );
}

type RngInternal = Rng & { readonly _seeded: SeededRng };

export function createRngInternal(seed: number | bigint | string): RngInternal {
  const seeded = createSeededRng(seed);
  const wrap = (s: SeededRng): RngInternal => ({
    _seeded: s,
    next: () => s.random(),
    fork: (name) => wrap(s.fork(name)),
  });
  return wrap(seeded);
}

export type RecordingRng = Rng & {
  readonly draws: () => readonly number[];
  readonly clear: () => void;
};

export function createRecordingRng(base: Rng): RecordingRng {
  const buf: number[] = [];
  const wrap = (r: Rng): RecordingRng => ({
    next() {
      const v = r.next();
      buf.push(v);
      return v;
    },
    fork(name) {
      return wrap(r.fork(name));
    },
    draws: () => buf.slice(),
    clear() {
      buf.length = 0;
    },
  });
  return wrap(base);
}

export type ReplayingRng = Rng & {
  readonly remaining: () => number;
};

export function createReplayingRng(draws: readonly number[]): ReplayingRng {
  let i = 0;
  const next = (): number => {
    if (i >= draws.length) {
      throw new Error(
        `ReplayingRng: exhausted after ${String(draws.length)} draws`
      );
    }
    return draws[i++]!;
  };
  const self: ReplayingRng = {
    next,
    fork() {
      // Fork during replay still consumes from the same sequential stream
      // so recorded draw counts match the original recording order.
      return self;
    },
    remaining: () => draws.length - i,
  };
  return self;
}
