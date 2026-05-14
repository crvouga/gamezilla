export type SplitMix32State = { readonly x: number };

export function createSplitMix32(seed: number): {
  nextU01: () => number;
  getState: () => SplitMix32State;
  setState: (s: SplitMix32State) => void;
} {
  let x = seed >>> 0;
  const nextUint32 = (): number => {
    x = (x + 0x9e3779b9) >>> 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return (z ^ (z >>> 15)) >>> 0;
  };
  return {
    nextU01: () => nextUint32() / 2 ** 32,
    getState: () => ({ x }),
    setState: (s: SplitMix32State) => {
      x = s.x >>> 0;
    },
  };
}

export function hashSeedString(seed: string): number {
  let h = 2_166_138_261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16_777_619) >>> 0;
  }
  return h === 0 ? 0xdeadbeef : h;
}
