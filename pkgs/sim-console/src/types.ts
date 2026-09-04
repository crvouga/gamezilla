/**
 * Report types — re-export the `@pkgs/sim` RunReport algebra, plus
 * console-local topology/event shapes still used by the debugger chrome.
 */

export type {
  ReportFrame,
  ReportSnapshotBlob,
  ReportStep,
  ReportStepStatus,
  RunReport,
  RunReportMeta,
  RunReportOptions,
  RunSummary,
  RunsIndex,
  SnapshotMedia,
  SuiteManifest,
  SuiteTestSummary,
} from '@pkgs/sim';
export {
  GENERATION_KEY,
  isLatestRunId,
  LATEST_RUN_ID,
  mintRunId,
  RUNS_INDEX_KEY,
  resolveReportOptions,
  runManifestKey,
  runPrefix,
  sanitizeRunId,
  sanitizeTestId,
  testFrameKey,
  testReportKey,
} from '@pkgs/sim';

/** @deprecated Prefer {@link RunReport}. */
export type SimulationReportData = import('@pkgs/sim').RunReport;
/** @deprecated Prefer {@link ReportStep}. */
export type SimulationStep = import('@pkgs/sim').ReportStep;
/** @deprecated Prefer {@link ReportStepStatus}. */
export type SimulationStepStatus = import('@pkgs/sim').ReportStepStatus;

/** Fine-grained timeline event (optional sidecar; not written by @pkgs/sim). */
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

/** Topology JSON shape captured by product `topology` snapshot. */
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

export const DEFAULT_FRAME_INTERVAL_MS = 250;
export const DEFAULT_MAX_FRAMES_PER_STEP = 1;
export const DEFAULT_PUBLISH_THROTTLE_MS = 250;
export const DEFAULT_REPORT_SERVER_PORT = 7789;

/** Bun local report server path for playground snapshot ObjectStore HTTP proxy. */
export const PLAYGROUND_SNAPSHOT_OBJECTS_PATH =
  '/api/playground-snapshots/objects';
