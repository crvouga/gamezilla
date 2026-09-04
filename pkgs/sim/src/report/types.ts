import type { ObjectStore } from '@pkgs/object-store/interface';

/** How a captured value is encoded on disk and rendered in the console. */
export type SnapshotMedia = 'json' | 'html' | 'png' | 'text' | 'bytes';

export type ReportStepStatus = 'passed' | 'failed';

/**
 * One blob produced by a snapshotter at a point in time.
 * Multi-actor UI maps become one entry per nodeId.
 */
export type ReportSnapshotBlob = {
  readonly name: string;
  readonly media: SnapshotMedia;
  /** Relative path under the test dir, e.g. `frames/f-00001.html.alice.html`. */
  readonly file: string;
  readonly nodeId?: string;
};

/** Discrete visual/state capture within a report step. */
export type ReportFrame = {
  readonly index: number;
  readonly capturedAtMs: number;
  readonly durationMs?: number;
  readonly snapshots: readonly ReportSnapshotBlob[];
};

/** One labeled entry on the report timeline (apply or explicit record). */
export type ReportStep = {
  readonly index: number;
  readonly kind: string;
  readonly title: string;
  readonly status: ReportStepStatus;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly actorId?: string;
  readonly selector?: string;
  readonly detail?: string;
  readonly action?: string;
  readonly args?: readonly unknown[];
  readonly error?: string;
  readonly frames: readonly ReportFrame[];
};

export type RunReportMeta = {
  readonly system: string;
  readonly runtime: string;
  readonly seed: string;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly status: ReportStepStatus;
  readonly runId: string;
  readonly testId: string;
  readonly actorIds: readonly string[];
  readonly sourceFile?: string;
};

/** In-memory / persisted timeline for one test run. */
export type RunReport = {
  readonly meta: RunReportMeta;
  readonly steps: readonly ReportStep[];
};

export type SuiteTestSummary = {
  readonly testId: string;
  readonly seed: string;
  readonly status: ReportStepStatus;
  readonly durationMs: number;
  readonly stepCount: number;
  readonly frameCount: number;
  /** SPA path relative to bucket+run, e.g. `/t/auth-login-logout`. */
  readonly path: string;
  readonly system?: string;
  readonly runtime?: string;
};

export type SuiteManifest = {
  readonly tests: readonly SuiteTestSummary[];
  readonly updatedAtMs: number;
};

export type RunSummary = {
  readonly id: string;
  readonly updatedAtMs: number;
  readonly status: ReportStepStatus;
  readonly testCount: number;
  readonly frameCount: number;
};

export type RunsIndex = {
  readonly runs: readonly RunSummary[];
};

/** Metadata for an open `run.record(...)` call. */
export type RecordStepMeta = {
  readonly kind: string;
  readonly title: string;
  readonly actorId?: string;
  readonly selector?: string;
  readonly detail?: string;
  /** Capture snapshots before `fn` (e.g. before close unmounts). */
  readonly snapshotBefore?: boolean;
  /** Skip registered snapshotters for this step. */
  readonly skipSnapshot?: boolean;
};

export type ReportCaptureMode = 'apply' | 'none';

export type RunReportOptions = {
  /** When false, reporting is disabled even if options object is passed. */
  readonly enabled?: boolean;
  /** Object store for this report bucket (required for persistence). */
  readonly store?: ObjectStore;
  /**
   * Run id under `runs/<runId>/`. Default: `YYYYMMDDTHHmmss` UTC from `now`.
   */
  readonly runId?: string;
  /**
   * Stable id for this test under the run (`tests/<testId>/`).
   * Default: sanitized system name.
   */
  readonly testId?: string;
  /**
   * Epoch-ms clock for step timestamps. Default: session clock.
   */
  readonly now?: () => number;
  /**
   * When to auto-open a report step. Default `apply` (each `s.apply`).
   * `advanceTime` never opens a step (avoids poll spam).
   */
  readonly capture?: ReportCaptureMode;
  /** Repo-relative path to the test source file when known. */
  readonly sourceFile?: string;
};

/** Reserved SPA alias for “follow newest run”; never mint this as a real run id. */
export const LATEST_RUN_ID = 'latest';

export function isLatestRunId(id: string | null | undefined): boolean {
  return id === LATEST_RUN_ID;
}

export function sanitizeTestId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.length > 0 ? cleaned : 'test';
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

export function resolveReportOptions(
  report: boolean | RunReportOptions | undefined
): RunReportOptions | null {
  if (report === undefined || report === false) return null;
  if (report === true) return { enabled: true };
  if (report.enabled === false) return null;
  return {
    enabled: true,
    ...(report.store !== undefined ? { store: report.store } : {}),
    ...(report.runId !== undefined ? { runId: report.runId } : {}),
    ...(report.testId !== undefined ? { testId: report.testId } : {}),
    ...(report.now !== undefined ? { now: report.now } : {}),
    ...(report.capture !== undefined ? { capture: report.capture } : {}),
    ...(report.sourceFile !== undefined
      ? { sourceFile: report.sourceFile }
      : {}),
  };
}
