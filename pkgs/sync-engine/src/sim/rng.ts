/**
 * Re-export canonical seeded RNG from {@link @pkgs/io}.
 * Worlds fork from a single root (`createSeededRng(seed)` / parent Io).
 */
export { createSeededRng, type SeededRng } from '@pkgs/io';
