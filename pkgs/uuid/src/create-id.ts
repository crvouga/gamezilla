// @io-wall-ok
/**
 * Injectable id mint for mutations / domain creates.
 * Production defaults to `crypto.randomUUID`.
 */

export type CreateId = () => string;

/** Uniform float in [0, 1) — for jitter / seeded workloads. */
export type Random = () => number;

export const cryptoCreateId: CreateId = () => crypto.randomUUID();

export const mathRandom: Random = () => Math.random();

export function resolveCreateId(override?: CreateId): CreateId {
  return override ?? cryptoCreateId;
}

export function resolveRandom(override?: Random): Random {
  return override ?? mathRandom;
}
