/**
 * `@pkgs/simulation-report` — capture UI simulation timelines into an
 * ObjectStore. Serve the multi-bucket SPA via
 * `@pkgs/simulation-report/server` (`createSimulationReportServer`).
 */

export {
  findMonorepoRoot,
  LOCAL_REPORT_DATA_DIRNAME,
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
  type SimulationFrameDatabase,
  type SimulationFrameView,
  type SimulationReportData,
  type SimulationReportEvent,
  type SimulationReportMeta,
  type SimulationReportOptions,
  type SimulationReportTopology,
  type SimulationStep,
  type SimulationStepKind,
  type SimulationStepStatus,
  type SuiteManifest,
  type SuiteTestSummary,
  sanitizeRunId,
  sanitizeTestId,
  type UiAttribution,
} from './types';
export { deleteRun, type PruneOptions, pruneRuns } from './writer/prune';
export {
  type FrameCaptureState,
  hashString,
  SimulationReporter,
  type SimulationReporterOptions,
} from './writer/reporter';
