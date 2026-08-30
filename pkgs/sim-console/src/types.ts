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

/** Per-node SQLite dump attached to a UI frame (content-addressed blob). */
export type SimulationFrameDatabase = {
  /** Sim address (`server`, `client:alice`). */
  readonly nodeId: string;
  /** Path relative to the test report dir, e.g. `frames/db/<sha>.sqlm`. */
  readonly file: string;
  /** SHA-256 of the SQLM / SQLite bytes. */
  readonly sha256: string;
  /** Uncompressed byte length. */
  readonly byteLength: number;
};

/** Per-actor HTML snapshot for a frame (server has no UI). */
export type SimulationFrameView = {
  readonly nodeId: string;
  /** Path relative to the test report dir, e.g. `frames/f-00001.alice.html`. */
  readonly file: string;
};

/** Per-node attribute bag attached to a UI frame. */
export type SimulationFrameAttribute = {
  readonly nodeId: string;
  readonly kind: 'html' | 'sqlite' | 'ingress' | 'egress' | (string & {});
  /** Path relative to the test report dir (html / sqlite blob). */
  readonly file?: string;
  /** SHA-256 of uncompressed sqlite bytes. */
  readonly sha256?: string;
  readonly byteLength?: number;
  /** Event ids for ingress/egress slices (payloads live in events.json). */
  readonly eventIds?: readonly string[];
};

/** Small World checkpoint sidecar next to sqlite dumps (`frames/f-NNNNN.checkpoint.json`). */
export type SimulationFrameCheckpoint = {
  readonly file: string;
  readonly clockMs: number;
  readonly clockPaused: boolean;
  readonly clientIds: readonly string[];
  readonly roomTopics: readonly string[];
  readonly partitions: readonly string[];
  readonly skewByAddress: Readonly<Record<string, number>>;
  readonly downAddresses: readonly string[];
  readonly evictedAddresses: readonly string[];
};

export type SimulationFrame = {
  /** Path relative to the test report directory (e.g. `frames/f-00001.html`). */
  readonly file: string;
  readonly capturedAtMs: number;
  /**
   * How long this frame was current before the next frame (or step end).
   * Filled on flush for realtime playback.
   */
  readonly durationMs?: number;
  /** Live SQLite dumps for server + actors at this frame (optional on legacy). */
  readonly databases?: readonly SimulationFrameDatabase[];
  /** Per-actor HTML views (optional on legacy). */
  readonly views?: readonly SimulationFrameView[];
  /** Topology-aware attribute bags (preferred over views/databases). */
  readonly attributes?: readonly SimulationFrameAttribute[];
  /** Optional per-frame World checkpoint metadata (legacy hydrate path). */
  readonly checkpoint?: SimulationFrameCheckpoint;
};

/** Fine-grained timeline event persisted in events.json. */
export type SimulationReportEvent = {
  readonly id: string;
  readonly kind: string;
  readonly atMs: number;
  readonly nodeId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly title?: string;
  readonly detail?: string;
  readonly status?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
};

/** Topology + seed/fuzz snapshot persisted as topology.json. */
export type SimulationReportTopology = {
  readonly seed: string;
  readonly fuzz: {
    readonly enabled: boolean;
    readonly intensity: number;
    readonly streamId: string;
  } | null;
  readonly definition: {
    readonly kinds: Readonly<
      Record<string, { readonly attributes: readonly string[] }>
    >;
    readonly nodes: readonly { readonly id: string; readonly kind: string }[];
    readonly edges: readonly {
      readonly from: string;
      readonly to: string;
      readonly kind: string;
    }[];
    readonly spawn: Readonly<
      Record<
        string,
        {
          readonly edges: readonly {
            readonly to: string;
            readonly kind: string;
          }[];
        }
      >
    >;
  };
  readonly nodes: readonly {
    readonly id: string;
    readonly kind: string;
    readonly status: string;
    readonly attributes: readonly string[];
    readonly clockSkewMs: number;
  }[];
  readonly edges: readonly {
    readonly from: string;
    readonly to: string;
    readonly kind: string;
    readonly state: string;
    readonly latencyMs: number;
    readonly jitterMs: number;
    readonly dropRate: number;
    readonly duplicateRate: number;
    readonly failWithRemaining: number;
  }[];
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
  /** Fuzz config when the run used fuzz mode. */
  readonly fuzz?: {
    readonly enabled: boolean;
    readonly intensity: number;
    readonly streamId: string;
  } | null;
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
   * Epoch-ms clock for step timestamps. Default: simulation clock.
   * Wall-clock UI sims should pass a moving clock so durations are not zero.
   */
  readonly now?: () => number;
  /**
   * Interval for change-gated frame polling during `waitFor` / `step`.
   * Default 250.
   */
  readonly frameIntervalMs?: number;
  /**
   * Max frames kept per step (change-gated). Default 1.
   */
  readonly maxFramesPerStep?: number;
  /**
   * Min gap between mid-run `publishProgress` writes. Default 250.
   * Flush / failure always publish immediately.
   */
  readonly publishThrottleMs?: number;
  /**
   * Repo-relative path to the test source file. Default: Jest `testPath`
   * when available.
   */
  readonly sourceFile?: string;
};

export const DEFAULT_FRAME_INTERVAL_MS = 250;
export const DEFAULT_MAX_FRAMES_PER_STEP = 1;
/** Coalesce mid-run steps/manifest rewrites so SSE stays live without FS spam. */
export const DEFAULT_PUBLISH_THROTTLE_MS = 250;
export const DEFAULT_REPORT_SERVER_PORT = 7789;

/** Bun local report server path for playground snapshot ObjectStore HTTP proxy. */
export const PLAYGROUND_SNAPSHOT_OBJECTS_PATH =
  '/api/playground-snapshots/objects';

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
    ...(report.publishThrottleMs !== undefined
      ? { publishThrottleMs: report.publishThrottleMs }
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
