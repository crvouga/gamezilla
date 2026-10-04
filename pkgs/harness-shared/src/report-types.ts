import type { ObjectStore } from '@pkgs/object-store-shared/interface';

/** How a captured value is encoded on disk and rendered in the report. */
export type SnapshotMedia = 'json' | 'html' | 'png' | 'text' | 'bytes';

export type ReportStepStatus = 'passed' | 'failed';

/** Test outcome after the harness (e.g. the test runner) has weighed in. */
export type ReportTestStatus = 'passed' | 'failed' | 'skipped';

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
  /**
   * Gesture target, set only on the frame captured right before a UI step
   * acts (the target is still mounted). Viewers highlight it on this frame.
   */
  readonly hit?: ReportStepHit;
};

/**
 * Where a UI gesture landed — test-id path (chained first-match, as the
 * driver resolves it) + optional tap point relative to the target box.
 * Viewers resolve the path against the snapshot DOM for real geometry.
 */
export type ReportStepHit = {
  readonly path: readonly string[];
  readonly point?: {
    readonly xRatio: number;
    readonly yRatio: number;
  };
};

/**
 * One labeled entry on the report timeline. Steps nest: an `apply` step
 * holds the UI ops recorded while its action ran.
 */
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
  readonly errorStack?: string;
  readonly frames: readonly ReportFrame[];
  readonly steps: readonly ReportStep[];
};

export type RunReportMeta = {
  readonly system: string;
  readonly runtime: string;
  readonly seed: string;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly status: ReportTestStatus;
  readonly runId: string;
  readonly testId: string;
  /** Human title (defaults to `testId`). */
  readonly title: string;
  readonly actorIds: readonly string[];
  readonly sourceFile?: string;
  /** 1-based line of the call that opened this run, when known. */
  readonly sourceLine?: number;
  /** First failure message (step, property, or harness). */
  readonly error?: string;
  readonly errorStack?: string;
};

/** In-memory / persisted timeline for one test run. */
export type RunReport = {
  readonly meta: RunReportMeta;
  readonly steps: readonly ReportStep[];
};

export type SuiteTestSummary = {
  readonly testId: string;
  readonly title: string;
  readonly seed: string;
  readonly status: ReportTestStatus;
  readonly durationMs: number;
  readonly stepCount: number;
  readonly frameCount: number;
  readonly system: string;
  readonly runtime: string;
  readonly sourceFile?: string;
  readonly error?: string;
};

export type SuiteManifest = {
  readonly tests: readonly SuiteTestSummary[];
  readonly updatedAtMs: number;
};

export type RunSummary = {
  readonly id: string;
  readonly updatedAtMs: number;
  readonly status: ReportTestStatus;
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
  /** Press / gesture target; persisted onto the step's pre-action frame. */
  readonly hit?: ReportStepHit;
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
  /** Human title shown in reports. Default: `testId`. */
  readonly title?: string;
  /**
   * Epoch-ms clock for step timestamps. Default: session clock.
   */
  readonly now?: () => number;
  /**
   * When to auto-open a report step. Default `apply` (each `s.apply`).
   * `advanceTime` never opens a step (avoids poll spam).
   */
  readonly capture?: ReportCaptureMode;
  /**
   * Capture the registered snapshotters (UI frames, state) onto each step.
   * Default true. False keeps the timeline — every step, its outcome and
   * error — without the frames, which are what make a report expensive.
   */
  readonly frames?: boolean;
  /** Repo-relative path to the test source file when known. */
  readonly sourceFile?: string;
  /** 1-based source line of the call that opened the run, when known. */
  readonly sourceLine?: number;
};

export function sanitizeTestId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.length > 0 ? cleaned : 'test';
}

export function sanitizeRunId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
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
  const { enabled: _enabled, ...rest } = report;
  return { enabled: true, ...rest };
}
