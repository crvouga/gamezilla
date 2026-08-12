/**
 * `@pkgs/simulation-report` — capture UI simulation timelines into an
 * ObjectStore. Serve the multi-bucket SPA via
 * `@pkgs/simulation-report/server` (`createSimulationReportServer`).
 */

export {
  findMonorepoRoot,
  LOCAL_REPORT_DATA_DIRNAME,
  resolveLocalReportDataDir,
} from './local-data-dir';
export {
  DEFAULT_FRAME_INTERVAL_MS,
  DEFAULT_MAX_FRAMES_PER_STEP,
  DEFAULT_REPORT_SERVER_PORT,
  mintRunId,
  type RunSummary,
  type RunsIndex,
  resolveReportOptions,
  type SimulationFrame,
  type SimulationReportData,
  type SimulationReportMeta,
  type SimulationReportOptions,
  type SimulationStep,
  type SimulationStepKind,
  type SimulationStepStatus,
  type SuiteManifest,
  type SuiteTestSummary,
  sanitizeRunId,
  sanitizeTestId,
} from './types';
export { deleteRun, type PruneOptions, pruneRuns } from './writer/prune';
export {
  type FrameCaptureState,
  hashString,
  SimulationReporter,
  type SimulationReporterOptions,
} from './writer/reporter';
