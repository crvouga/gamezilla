/**
 * Re-export canonical seeded RNG from {@link @pkgs/io}.
 * Prefer forking from {@link SimIo.rng} when a parent Io already exists.
 */
export { createSeededRng, type SeededRng } from '@pkgs/io';
