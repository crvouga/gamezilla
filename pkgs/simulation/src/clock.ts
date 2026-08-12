/**
 * Re-exports sim clock helpers from `@pkgs/io` for consumers that only need
 * the clock type (prefer {@link createSimIo} / {@link Simulation.open}).
 */
export {
  createSimIo,
  type SimClock as SimulationClock,
} from '@pkgs/io';
