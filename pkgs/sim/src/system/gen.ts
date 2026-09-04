import type { Rng } from '../kernel/rng';

/** Randomness: a deterministic function of draws from an Rng. */
export type Gen<T> = (rng: Rng) => T;
