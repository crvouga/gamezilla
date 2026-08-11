export type SimulationStepStatus = 'passed' | 'failed';

export type SimulationStepKind =
  | 'launch'
  | 'close'
  | 'tap'
  | 'tapAt'
  | 'typeText'
  | 'clearText'
  | 'pressKey'
  | 'scroll'
  | 'navigateBack'
  | 'waitFor'
  | 'nav.open'
  | 'step';

export type SimulationStep = {
  readonly index: number;
  readonly actorId: string;
  readonly kind: SimulationStepKind;
  readonly title: string;
  readonly selector?: string;
  readonly detail?: string;
  readonly status: SimulationStepStatus;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly error?: string;
  readonly snapshotHtml?: string;
  readonly snapshotFile?: string;
};

export type SimulationReportMeta = {
  readonly seed: string;
  readonly ui: string;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly status: SimulationStepStatus;
  readonly actorIds: readonly string[];
  readonly outDir: string;
};

export type SimulationReportData = {
  readonly meta: SimulationReportMeta;
  readonly steps: readonly SimulationStep[];
};

export type SimulationReportOptions = {
  /** When false, reporting is disabled even if options object is passed. */
  readonly enabled?: boolean;
  /**
   * Directory for this run's artifacts. Default:
   * `simulation-report/<runId>` under `process.cwd()`.
   */
  readonly outDir?: string;
};

export function resolveReportOptions(
  report: boolean | SimulationReportOptions | undefined
): SimulationReportOptions | null {
  if (report === undefined || report === false) return null;
  if (report === true) return { enabled: true };
  if (report.enabled === false) return null;
  return {
    enabled: true,
    ...(report.outDir !== undefined ? { outDir: report.outDir } : {}),
  };
}
