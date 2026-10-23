/**
 * Injectable id mint for mutations / domain creates.
 * Composition roots inject via env `createId` / `random`.
 */

export type CreateId = () => string;

/** Uniform float in [0, 1) — for jitter / seeded workloads. */
export type Random = () => number;
