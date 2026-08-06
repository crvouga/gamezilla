/**
 * Seeded PRNG (splitmix64 → mulberry32 float) for deterministic simulation.
 * Same seed ⇒ identical stream forever.
 */

export type SeededRng = {
  readonly seed: bigint;
  /** Uniform float in [0, 1). */
  readonly random: () => number;
  /** Integer in [0, max) — max must be > 0. */
  readonly int: (max: number) => number;
  /** True with probability p in [0, 1]. */
  readonly bool: (p: number) => boolean;
  /** Pick one element; empty array throws. */
  readonly pick: <T>(items: readonly T[]) => T;
  /** Independent child stream (derived seed). */
  readonly fork: (label: string) => SeededRng;
};

function splitmix64(state: bigint): {
  readonly next: bigint;
  readonly out: bigint;
} {
  let z = (state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
  return { next: z, out: z ^ (z >> 31n) };
}

function hashLabel(seed: bigint, label: string): bigint {
  let h = seed ^ 0x243f6a8885a308d3n;
  for (let i = 0; i < label.length; i += 1) {
    h = (h ^ BigInt(label.charCodeAt(i))) * 0x100000001b3n;
    h &= 0xffffffffffffffffn;
  }
  return h === 0n ? 1n : h;
}

function toSeedBigInt(seed: number | bigint | string): bigint {
  if (typeof seed === 'bigint')
    return seed === 0n ? 1n : seed & 0xffffffffffffffffn;
  if (typeof seed === 'string') {
    let h = 0xcbf29ce484222325n;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= BigInt(seed.charCodeAt(i));
      h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
    }
    return h === 0n ? 1n : h;
  }
  if (!Number.isFinite(seed)) return 1n;
  const asInt = BigInt(Math.floor(Math.abs(seed))) & 0xffffffffffffffffn;
  return asInt === 0n ? 1n : asInt;
}

/** Create a seeded RNG. `seed` 0 is remapped to 1 (splitmix rejects zero poorly). */
export function createSeededRng(seed: number | bigint | string): SeededRng {
  const root = toSeedBigInt(seed);
  let state = root;

  const nextU32 = (): number => {
    const step = splitmix64(state);
    state = step.next;
    return Number(step.out & 0xffffffffn);
  };

  const random = (): number => nextU32() / 0x1_0000_0000;

  return {
    seed: root,
    random,
    int(max: number): number {
      if (!(max > 0) || !Number.isFinite(max)) {
        throw new Error(`SeededRng.int: max must be > 0, got ${max}`);
      }
      return Math.floor(random() * max);
    },
    bool(p: number): boolean {
      if (p <= 0) return false;
      if (p >= 1) return true;
      return random() < p;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('SeededRng.pick: empty');
      return items[Math.floor(random() * items.length)]!;
    },
    fork(label: string): SeededRng {
      return createSeededRng(hashLabel(root, label));
    },
  };
}
