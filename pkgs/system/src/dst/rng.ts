/** Deterministic PRNG + clock for DST worlds. */

export function createSeededRandom(
  seed: number | bigint | string
): () => number {
  let s = hashSeed(seed) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function hashSeed(seed: number | bigint | string): number {
  if (typeof seed === 'number') return seed | 0;
  if (typeof seed === 'bigint') return Number(seed & 0xffffffffn) | 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

export function createSimClock(startMs = 0): {
  now(): number;
  advance(ms: number): void;
} {
  let t = startMs;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
  };
}
