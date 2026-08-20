import type { CreateId, Random } from './create-id';
import { createSeededRng, type SeededRng } from './seeded-rng';

/** UUID-v4-shaped id mint from a [0, 1) random stream. */
export function createSeededCreateId(random: Random): CreateId {
  return () => {
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(random() * 256);
    }
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

export type SimIds = {
  readonly seed: bigint;
  readonly rng: SeededRng;
  readonly random: Random;
  readonly createId: CreateId;
};

/** Seeded ids + random for simulation (independent forks of the root seed). */
export function createSimIds(seed: number | bigint | string): SimIds {
  const rng = createSeededRng(seed);
  return {
    seed: rng.seed,
    rng,
    random: rng.fork('io').random,
    createId: createSeededCreateId(rng.fork('ids').random),
  };
}
