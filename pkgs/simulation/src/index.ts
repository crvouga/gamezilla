/**
 * `@pkgs/simulation` — application-agnostic topology-aware UI simulation.
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
export {
  getCurrentSimNodeId,
  runWithSimNode,
} from './context/sim-node-als';
export type {
  EventMatcher,
  SimulationEvent,
  SimulationEventKind,
} from './events';
export type { SimEdgeHandle, SimNodeHandle, SkewEffect } from './handles';
export {
  createSerializedHttp,
  installSimGlobalFetch,
} from './http/sim-http';
export {
  createMeshedHttp,
  createSimMesh,
  createSimPubSubBus,
  type FailWithSpec,
  type SimMesh,
  type SimPubSubBus,
  type SimPubSubPeer,
} from './network';
export { Simulation } from './open-simulation';
export type {
  SimulationFuzzOptions,
  SimulationOptions,
  SimulationReportOptions,
} from './options';
export { createSeededRng, type SeededRng } from './rng';
export {
  type BootMigratedSimSqliteArgs,
  bootMigratedSimSqlite,
  computeSimSqliteSeedFingerprint,
  createSerialSqlClient,
  ensureSimSqliteSeedBuffer,
  SIM_SQLITE_SEED_VERSION,
  type SimSqliteHandle,
  type SimSqliteLiveRefs,
  type SimSqliteMigrateHandle,
} from './sqlite/boot-sim-sqlite';
export type {
  InProcessSimulationSession,
  LiveNodeAdapter,
  PlaywrightSimulationSession,
  SimulationDriverWait,
  SimulationSession,
  SimulationSqliteNodeSnapshot,
  SimulationStartContext,
  SimulationSystem,
  SimulationSystemHandle,
  SimulationUiKind,
} from './system-port';
export { createSimTiming, type SimTiming } from './timing/sim-timing';
export {
  type AttributeKind,
  type AttributeSnapshot,
  defaultHtmlSpawnKind,
  defineTopology,
  type EdgeDirection,
  type EdgeKind,
  kindHasHtml,
  type TopologyDefinition,
  type TopologySnapshot,
} from './topology';
