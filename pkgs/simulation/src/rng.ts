/**
 * Seeded PRNG for deterministic simulation.
 * Same seed ⇒ identical stream.
 */

export type SeededRng = {
  readonly seed: bigint;
  /** Uniform float in [0, 1). */
  readonly random: () => number;
  /** Integer in [0, max). */
  readonly int: (max: number) => number;
  /** Independent child stream. */
  readonly fork: (label: string) => SeededRng;
};

function toSeedBigInt(seed: number | bigint | string): bigint {
  if (typeof seed === 'bigint') {
    return seed === 0n ? 1n : seed & 0xffffffffffffffffn;
  }
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

function hashLabel(seed: bigint, label: string): bigint {
  let h = seed ^ 0x243f6a8885a308d3n;
  for (let i = 0; i < label.length; i += 1) {
    h = (h ^ BigInt(label.charCodeAt(i))) * 0x100000001b3n;
    h &= 0xffffffffffffffffn;
  }
  return h === 0n ? 1n : h;
}

/** Mulberry32 over a 32-bit seed derived from the bigint seed. */
export function createSeededRng(seed: number | bigint | string): SeededRng {
  const root = toSeedBigInt(seed);
  let state = Number(root & 0xffffffffn) >>> 0;
  if (state === 0) state = 1;

  const random = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    seed: root,
    random,
    int(max: number): number {
      if (!(max > 0) || !Number.isFinite(max)) {
        throw new Error(`SeededRng.int: max must be > 0, got ${max}`);
      }
      return Math.floor(random() * max);
    },
    fork(label: string): SeededRng {
      return createSeededRng(hashLabel(root, label));
    },
  };
}
