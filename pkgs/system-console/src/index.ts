/**
 * `@pkgs/system-console` — capture system/DST timelines into an ObjectStore.
 * Browse them via `SystemConsoleApp` (`@pkgs/system-console/client`) and
 * `createSystemConsoleApp` (`@pkgs/system-console/server`).
 */

export {
  findMonorepoRoot,
  LOCAL_REPORT_DATA_DIRNAME,
  type PathExists,
  resolveLocalReportDataDir,
  toRepoRelativePath,
} from './local-data-dir';
export {
  DEFAULT_FRAME_INTERVAL_MS,
  DEFAULT_MAX_FRAMES_PER_STEP,
  DEFAULT_PUBLISH_THROTTLE_MS,
  DEFAULT_REPORT_SERVER_PORT,
  isLatestRunId,
  LATEST_RUN_ID,
  mintRunId,
  type RunSummary,
  type RunsIndex,
  resolveReportOptions,
  type SimulationFrame,
  type SimulationFrameAttribute,
  type SimulationFrameCheckpoint,
  type SimulationFrameDatabase,
  type SimulationFrameView,
  type SimulationReportData,
  type SimulationReportEvent,
  type SimulationReportMeta,
  type SimulationReportOptions,
  type SimulationStep,
  type SimulationStepKind,
  type SimulationStepStatus,
  type SuiteManifest,
  type SuiteTestSummary,
  sanitizeRunId,
  sanitizeTestId,
  type UiAttribution,
} from './types';
export { wallPathExists } from './wall-path-exists';
export { projectReportTopology } from './writer/project-topology';
export { deleteRun, type PruneOptions, pruneRuns } from './writer/prune';
export {
  type FrameCaptureState,
  hashString,
  SimulationReporter,
  type SimulationReporterOptions,
} from './writer/reporter';
export { createReportingDriver } from './writer/reporting-driver';
