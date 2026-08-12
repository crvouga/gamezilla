/**
 * `@pkgs/simulation` — application-agnostic multi-actor UI simulation.
 *
 * Acceptance tests assert only through {@link SimActor.ui} (`@pkgs/ui-testing`
 * Driver). The full system under test is injected via {@link SimulationSystem}.
 * Deterministic I/O comes from `@pkgs/io` (`createSimIo`).
 */

export type {
  SimulationFrame,
  SimulationReportData,
  SimulationStep,
  SimulationStepKind,
  SimulationStepStatus,
} from '@pkgs/simulation-report';
export type { SimActor } from './actor';
export { createSimIo, type SimulationClock } from './clock';
export { openSimulation, type Simulation } from './open-simulation';
export type {
  SimulationOptions,
  SimulationReportOptions,
} from './options';
export { createSeededRng, type SeededRng } from './rng';
export type {
  InProcessSimulationSession,
  PlaywrightSimulationSession,
  SimulationSession,
  SimulationStartContext,
  SimulationSystem,
  SimulationSystemHandle,
  SimulationUiKind,
} from './system-port';
