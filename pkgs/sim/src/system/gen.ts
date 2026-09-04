import type { Rng } from '../internals/rng';

/** Randomness: a deterministic function of draws from an Rng. */
export type Gen<T> = (rng: Rng) => T;
