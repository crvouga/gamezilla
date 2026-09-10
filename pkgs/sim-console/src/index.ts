/**
 * `@pkgs/sim-console` — browse `@pkgs/sim` RunReports from an ObjectStore.
 * Capture is owned by `@pkgs/sim` (`system.snapshot` / `run({ report })`).
 * Browse via `SimConsoleApp` (`@pkgs/sim-console/client`) and
 * `createSimConsoleApp` (`@pkgs/sim-console/server`).
 */

export {
  DEFAULT_FRAME_INTERVAL_MS,
  DEFAULT_MAX_FRAMES_PER_STEP,
  DEFAULT_PUBLISH_THROTTLE_MS,
  DEFAULT_REPORT_SERVER_PORT,
  GENERATION_KEY,
  isLatestRunId,
  LATEST_RUN_ID,
  mintRunId,
  PRODUCT_SIMULATOR_SNAPSHOT_OBJECTS_PATH,
  type ReportFrame,
  type ReportSnapshotBlob,
  type ReportStep,
  type ReportStepStatus,
  RUNS_INDEX_KEY,
  type RunReport,
  type RunReportMeta,
  type RunReportOptions,
  type RunSummary,
  type RunsIndex,
  resolveReportOptions,
  runManifestKey,
  type SimulationReportData,
  type SimulationReportEvent,
  type SimulationReportTopology,
  type SimulationStep,
  type SimulationStepStatus,
  type SnapshotMedia,
  type SuiteManifest,
  type SuiteTestSummary,
  sanitizeRunId,
  sanitizeTestId,
  testFrameKey,
  testReportKey,
} from './types';
export { projectReportTopology } from './writer/project-topology';
export { deleteRun, type PruneOptions, pruneRuns } from './writer/prune';
