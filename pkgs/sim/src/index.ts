// Public API — algebra of singular primitives

export type { Clock } from '@pkgs/clock';
export type { JsonPrimitive, JsonValue } from './internals/json';
export type { Rng } from './internals/rng';
export { asSeededRng } from './internals/rng';
export type { Scheduler as VirtualScheduler } from './internals/scheduler';
export type { Scheduler } from './internals/scheduler-api';
export type {
  Deliver,
  EndpointId,
  FlowKey,
  Network,
  NetworkFaults,
} from './models/network';
export { RELIABLE_NETWORK } from './models/network';
export type {
  CatalogSnapshot,
  RecordStepMeta,
  ReportCaptureMode,
  ReportFrame,
  ReportSnapshotBlob,
  ReportStep,
  ReportStepStatus,
  RunReport,
  RunReportMeta,
  RunReportOptions,
  RunSummary,
  RunsIndex,
  Snapshot,
  SnapshotDef,
  SnapshotMedia,
  SuiteManifest,
  SuiteTestSummary,
} from './report';
export {
  defineSnapshot,
  GENERATION_KEY,
  isLatestRunId,
  isSnapshot,
  LATEST_RUN_ID,
  mediaExtension,
  mintRunId,
  RUNS_INDEX_KEY,
  resolveReportOptions,
  runManifestKey,
  runPrefix,
  sanitizeRunId,
  sanitizeTestId,
  testFrameKey,
  testReportKey,
} from './report';
export type {
  ExploreOptions,
  RandomActionsOptions,
  RandomActionsReport,
  ReplayOptions,
  Report,
  Run,
  RunOptions,
  Transition,
} from './run';
export {
  ActionNotEnabled,
  ExploreFailedError,
  PropertyViolation,
} from './run';
export type {
  Capability,
  Endpoint,
  Ports,
  RealTimeRuntimeOptions,
  Runtime,
  Session,
  VirtualTimeRuntimeOptions,
} from './runtime';
export {
  CapabilityError,
  realTimeRuntime,
  virtualTimeRuntime,
} from './runtime';
export type {
  Action,
  ActionDef,
  ActionSlice,
  AppliedAction,
  ArgsSampler,
  Awaitable,
  CatalogAction,
  CatalogProperty,
  CheckpointAction,
  Gen,
  Property,
  PropertyDef,
  Read,
  Recording,
  RecordingMeta,
  ResolvedRuntime,
  RuntimeDef,
  RuntimeOption,
  Step,
  System,
  SystemCreate,
} from './system';
export {
  defineAction,
  defineProperty,
  defineRuntime,
  defineSystem,
  isRuntimeDef,
  parseRecording,
  RECORDING_VERSION,
  stringifyRecording,
} from './system';
