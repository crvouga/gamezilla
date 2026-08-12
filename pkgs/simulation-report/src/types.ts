import type { ObjectStore } from '@pkgs/object-store/interface';

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

export type SimulationFrame = {
  /** Path relative to the test report directory (e.g. `frames/f-00001.html`). */
  readonly file: string;
  readonly capturedAtMs: number;
  /**
   * How long this frame was current before the next frame (or step end).
   * Filled on flush for realtime playback.
   */
  readonly durationMs?: number;
};

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
  /** @deprecated Prefer `frames`; retained only briefly during capture. */
  readonly snapshotHtml?: string;
  /** Last / primary frame path (back-compat with older report consumers). */
  readonly snapshotFile?: string;
  readonly frames?: readonly SimulationFrame[];
};

export type UiAttribution = {
  readonly components: Readonly<Record<string, number>>;
  readonly sources: Readonly<
    Record<string, { readonly count: number; readonly components: string[] }>
  >;
};

export type SimulationReportMeta = {
  readonly seed: string;
  readonly ui: string;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly status: SimulationStepStatus;
  readonly actorIds: readonly string[];
  readonly runId: string;
  readonly testId: string;
  /** Repo-relative test file path when known (e.g. Jest testPath). */
  readonly sourceFile?: string;
  /** Aggregated data-component / data-src from written frame HTML. */
  readonly uiAttribution?: UiAttribution;
};

export type SimulationReportData = {
  readonly meta: SimulationReportMeta;
  readonly steps: readonly SimulationStep[];
};

export type SuiteTestSummary = {
  readonly testId: string;
  readonly seed: string;
  readonly ui: string;
  readonly status: SimulationStepStatus;
  readonly durationMs: number;
  readonly stepCount: number;
  readonly frameCount: number;
  /** SPA path relative to bucket+run, e.g. `/t/auth-login-logout`. */
  readonly path: string;
};

export type SuiteManifest = {
  readonly tests: readonly SuiteTestSummary[];
  readonly updatedAtMs: number;
};

export type RunSummary = {
  readonly id: string;
  readonly updatedAtMs: number;
  readonly status: SimulationStepStatus;
  readonly testCount: number;
  readonly frameCount: number;
};

export type RunsIndex = {
  readonly runs: readonly RunSummary[];
};

export type SimulationReportOptions = {
  /** When false, reporting is disabled even if options object is passed. */
  readonly enabled?: boolean;
  /** Object store for this report bucket (required when reporting). */
  readonly store?: ObjectStore;
  /**
   * Run id under `runs/<runId>/`. Default: `YYYYMMDDTHHmmss` UTC from `now`.
   */
  readonly runId?: string;
  /**
   * Stable id for this test under the run (`tests/<testId>/`).
   * Default: sanitized seed.
   */
  readonly testId?: string;
  /**
   * Epoch-ms clock for step timestamps. Default: simulation `io.clock`.
   * Wall-clock UI sims should pass a moving clock so durations are not zero.
   */
  readonly now?: () => number;
  /**
   * Interval for change-gated frame polling during `waitFor` / `step`.
   * Default 100.
   */
  readonly frameIntervalMs?: number;
  /**
   * Max frames kept per step (change-gated). Default 50.
   */
  readonly maxFramesPerStep?: number;
  /**
   * Repo-relative path to the test source file. Default: Jest `testPath`
   * when available.
   */
  readonly sourceFile?: string;
};

export const DEFAULT_FRAME_INTERVAL_MS = 100;
export const DEFAULT_MAX_FRAMES_PER_STEP = 50;
export const DEFAULT_REPORT_SERVER_PORT = 7789;

export function resolveReportOptions(
  report: boolean | SimulationReportOptions | undefined
): SimulationReportOptions | null {
  if (report === undefined || report === false) return null;
  if (report === true) return { enabled: true };
  if (report.enabled === false) return null;
  return {
    enabled: true,
    ...(report.store !== undefined ? { store: report.store } : {}),
    ...(report.runId !== undefined ? { runId: report.runId } : {}),
    ...(report.testId !== undefined ? { testId: report.testId } : {}),
    ...(report.now !== undefined ? { now: report.now } : {}),
    ...(report.frameIntervalMs !== undefined
      ? { frameIntervalMs: report.frameIntervalMs }
      : {}),
    ...(report.maxFramesPerStep !== undefined
      ? { maxFramesPerStep: report.maxFramesPerStep }
      : {}),
    ...(report.sourceFile !== undefined
      ? { sourceFile: report.sourceFile }
      : {}),
  };
}

export function sanitizeTestId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.length > 0 ? cleaned : 'test';
}

/** Reserved SPA alias for “follow newest run”; never mint this as a real run id. */
export const LATEST_RUN_ID = 'latest';

export function isLatestRunId(id: string | null | undefined): boolean {
  return id === LATEST_RUN_ID;
}

export function sanitizeRunId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  if (cleaned === LATEST_RUN_ID) return 'latest_run';
  return cleaned.length > 0 ? cleaned : 'run';
}

/** Mint `YYYYMMDDTHHmmss` UTC from epoch ms. */
export function mintRunId(nowMs: number): string {
  const d = new Date(nowMs);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${mo}${day}T${h}${mi}${s}`;
}
