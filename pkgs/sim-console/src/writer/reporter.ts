import { setTimeout as delay } from 'node:timers/promises';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { SNAPSHOT_SHELL_CSS } from '@pkgs/ui-testing/drivers/in-process/serialize-host-tree-html';

import type {
  SimulationFrame,
  SimulationReportData,
  SimulationReportEvent,
  SimulationReportTopology,
  SimulationStep,
  SimulationStepKind,
  SimulationStepStatus,
  SuiteTestSummary,
} from '../types';
import {
  DEFAULT_FRAME_INTERVAL_MS,
  DEFAULT_MAX_FRAMES_PER_STEP,
  DEFAULT_PUBLISH_THROTTLE_MS,
  sanitizeRunId,
  sanitizeTestId,
} from '../types';
import type { SnapshotCheckpointMeta } from './frame-checkpoint';
import type { SnapshotDatabaseNode } from './frame-databases';
import type { SnapshotViewNode } from './frame-views';
import { snapshotShellKey, testStepsKey } from './keys';
import {
  buildReporterData,
  buildReporterStep,
  writeReporterFrame,
} from './reporter-frames';
import {
  assignFrameDurations,
  type FrameCaptureState,
  hashString,
  shouldPollKind,
  stripSnapshots,
} from './reporter-helpers';
import { publishTopologyAndEvents, rewriteRunsIndex } from './reporter-publish';
import {
  bumpGeneration,
  loadRunManifest,
  storePutJson,
  storePutText,
  upsertTestSummary,
} from './store-io';
import {
  createMutableUiAttribution,
  type MutableUiAttribution,
} from './ui-attribution';

export type { FrameCaptureState } from './reporter-helpers';
export { hashString } from './reporter-helpers';

export type SimulationReporterOptions = {
  readonly seed: string;
  readonly ui: string;
  readonly store: ObjectStore;
  readonly runId: string;
  readonly testId: string;
  readonly now: () => number;
  readonly frameIntervalMs?: number;
  readonly maxFramesPerStep?: number;
  readonly publishThrottleMs?: number;
  readonly sourceFile?: string;
  /**
   * When set, every kept UI frame also dumps these SQLite nodes
   * (gzip + content-hash under `frames/db/`).
   */
  readonly snapshotDatabases?: () => Promise<readonly SnapshotDatabaseNode[]>;
  /**
   * When set, every kept UI frame also writes `frames/f-NNNNN.checkpoint.json`
   * (client ids, clock, faults, rooms) for live hydrate.
   */
  readonly snapshotCheckpoint?: () =>
    | SnapshotCheckpointMeta
    | Promise<SnapshotCheckpointMeta>;
  /**
   * When set, every kept UI frame also dumps per-actor HTML under
   * `frames/f-NNNNN.<actorId>.html`.
   */
  readonly snapshotViews?: () => Promise<readonly SnapshotViewNode[]>;
  /** Fine-grained event log snapshot (written to events.json). */
  readonly snapshotEvents?: () => readonly SimulationReportEvent[];
  /**
   * Live sim topology — console maps it into topology.json.
   */
  readonly snapshotTopology?: () => SimulationReportTopology;
};

type RecordArgs = {
  readonly actorId: string;
  readonly kind: SimulationStepKind;
  readonly title: string;
  readonly selector?: string;
  readonly detail?: string;
  readonly run: () => Promise<void>;
  readonly snapshot: (options?: {
    readonly stylesheetHref?: string;
  }) => Promise<string | null>;
  /** Capture snapshot before `run` (e.g. before close unmounts). */
  readonly snapshotBefore?: boolean;
  /** Skip HTML snapshot capture for this step. */
  readonly skipSnapshot?: boolean;
  /**
   * Poll for change-gated frames while `run` executes (waitFor / step).
   * Default: true for `waitFor` and `step`.
   */
  readonly pollFrames?: boolean;
};

type StepOutcome = {
  readonly status: SimulationStepStatus;
  readonly errorMessage?: string;
  readonly cause?: unknown;
  readonly frames: SimulationFrame[];
};

/** Relative to `tests/<id>/frames/` → run `snapshot-shell.css`. */
const FRAME_STYLESHEET_HREF = '../../snapshot-shell.css';

/**
 * Collects per-step UI frames and writes them through an {@link ObjectStore}.
 */
export class SimulationReporter {
  private readonly seed: string;
  private readonly ui: string;
  private readonly store: ObjectStore;
  private readonly runId: string;
  private readonly testId: string;
  private readonly now: () => number;
  private readonly frameIntervalMs: number;
  private readonly maxFramesPerStep: number;
  private readonly publishThrottleMs: number;
  private readonly startedAtMs: number;
  private readonly sourceFile: string | undefined;
  private readonly steps: SimulationStep[] = [];
  private readonly actorIds = new Set<string>();
  private readonly attribution: MutableUiAttribution =
    createMutableUiAttribution();
  private frameSeq = 0;
  private flushed = false;
  private reportPath: string | undefined;
  private lastPublishAtMs = 0;
  private shellCssWritten = false;
  private readonly snapshotDatabases:
    | (() => Promise<readonly SnapshotDatabaseNode[]>)
    | undefined;
  private readonly snapshotCheckpoint:
    | (() => SnapshotCheckpointMeta | Promise<SnapshotCheckpointMeta>)
    | undefined;
  private readonly snapshotViews:
    | (() => Promise<readonly SnapshotViewNode[]>)
    | undefined;
  private readonly snapshotEvents:
    | (() => readonly SimulationReportEvent[])
    | undefined;
  private readonly snapshotTopology:
    | (() => SimulationReportTopology)
    | undefined;
  /** SHA-256 → relative file already written for this test. */
  private readonly writtenDbBlobs = new Map<string, string>();
  /** Acting actor for the in-flight `record` (used to pick primary HTML file). */
  private currentActorId: string | undefined;

  constructor(options: SimulationReporterOptions) {
    this.seed = options.seed;
    this.ui = options.ui;
    this.store = options.store;
    this.runId = sanitizeRunId(options.runId);
    this.testId = sanitizeTestId(options.testId);
    this.now = options.now;
    this.frameIntervalMs = options.frameIntervalMs ?? DEFAULT_FRAME_INTERVAL_MS;
    this.maxFramesPerStep =
      options.maxFramesPerStep ?? DEFAULT_MAX_FRAMES_PER_STEP;
    this.publishThrottleMs =
      options.publishThrottleMs ?? DEFAULT_PUBLISH_THROTTLE_MS;
    this.sourceFile = options.sourceFile;
    this.snapshotDatabases = options.snapshotDatabases;
    this.snapshotCheckpoint = options.snapshotCheckpoint;
    this.snapshotViews = options.snapshotViews;
    this.snapshotEvents = options.snapshotEvents;
    this.snapshotTopology = options.snapshotTopology;
    this.startedAtMs = options.now();
  }

  /** Object-store key for this test's `steps.json` after flush. */
  get path(): string | undefined {
    return this.reportPath;
  }

  get runKey(): string {
    return this.runId;
  }

  get testKey(): string {
    return this.testId;
  }

  async record(args: RecordArgs): Promise<void> {
    this.actorIds.add(args.actorId);
    this.currentActorId = args.actorId;
    const startedAtMs = this.now();
    const outcome = await this.runRecorded(args);
    this.currentActorId = undefined;
    this.pushStep(args, startedAtMs, this.now(), outcome);
    if (outcome.cause !== undefined) {
      await this.publishProgress();
      throw outcome.cause;
    }
    await this.maybePublishProgress();
  }

  /**
   * Capture a single change-gated frame into the current open step context.
   * Prefer `pollFrames` on `record`; this is for custom wait loops.
   */
  async captureFrame(
    snapshot: (options?: {
      readonly stylesheetHref?: string;
    }) => Promise<string | null>,
    state: FrameCaptureState
  ): Promise<void> {
    if (state.frames.length >= this.maxFramesPerStep) return;
    const html = await snapshot({ stylesheetHref: FRAME_STYLESHEET_HREF });
    // Unmounted / parked clients return null; do not write blank frames that
    // would overwrite the actor's last real UI in multi-client reports.
    if (html == null || html.trim() === '') return;
    if (this.snapshotDatabases === undefined) {
      const hash = hashString(html);
      if (hash === state.lastHash) return;
      state.lastHash = hash;
    }
    const frame = await this.writeFrame(html);
    state.frames.push(frame);
  }

  async flush(): Promise<SimulationReportData> {
    if (this.flushed && this.reportPath) {
      return this.toData(this.now());
    }
    this.flushed = true;
    return this.publishProgress({ final: true });
  }

  /**
   * Write partial (or final) steps/manifest/index + bump generation so SSE
   * watchers update the SPA mid-run.
   */
  private async maybePublishProgress(): Promise<void> {
    const now = this.now();
    if (
      this.lastPublishAtMs > 0 &&
      now - this.lastPublishAtMs < this.publishThrottleMs
    ) {
      return;
    }
    await this.publishProgress();
  }

  private async publishProgress(opts?: {
    readonly final?: boolean;
  }): Promise<SimulationReportData> {
    const endedAtMs = this.now();
    this.lastPublishAtMs = endedAtMs;
    const steps = assignFrameDurations(this.steps);
    const data = this.toData(endedAtMs, steps);

    if (!this.shellCssWritten || opts?.final) {
      await storePutText(
        this.store,
        snapshotShellKey(this.runId),
        SNAPSHOT_SHELL_CSS,
        'text/css; charset=utf-8'
      );
      this.shellCssWritten = true;
    }

    const finalData: SimulationReportData = {
      meta: data.meta,
      steps,
    };

    const stepsKey = testStepsKey(this.runId, this.testId);
    await storePutJson(this.store, stepsKey, stripSnapshots(finalData));
    await publishTopologyAndEvents({
      store: this.store,
      runId: this.runId,
      testId: this.testId,
      ...(this.snapshotEvents !== undefined
        ? { snapshotEvents: this.snapshotEvents }
        : {}),
      ...(this.snapshotTopology !== undefined
        ? { snapshotTopology: this.snapshotTopology }
        : {}),
    });

    const frameCount = steps.reduce(
      (n, s) => n + (s.frames?.length ?? (s.snapshotFile ? 1 : 0)),
      0
    );
    const summary: SuiteTestSummary = {
      testId: this.testId,
      seed: this.seed,
      ui: this.ui,
      status: data.meta.status,
      durationMs: data.meta.durationMs,
      stepCount: steps.length,
      frameCount,
      path: `/t/${this.testId}`,
    };

    const manifest = await loadRunManifest(this.store, this.runId);
    const tests = upsertTestSummary(manifest.tests, summary);
    await storePutJson(this.store, `runs/${this.runId}/manifest.json`, {
      tests,
      updatedAtMs: endedAtMs,
    });

    await rewriteRunsIndex({
      store: this.store,
      runId: this.runId,
      tests,
      updatedAtMs: endedAtMs,
    });
    await bumpGeneration(this.store);

    this.reportPath = stepsKey;
    if (opts?.final) this.flushed = true;
    return finalData;
  }

  private async runRecorded(args: RecordArgs): Promise<StepOutcome> {
    const wantSnapshot = args.skipSnapshot !== true;
    const pollFrames =
      wantSnapshot &&
      (args.pollFrames === true ||
        (args.pollFrames !== false && shouldPollKind(args.kind)));
    const state: FrameCaptureState = { frames: [], lastHash: '' };
    const stop = { value: false };

    try {
      await this.runWithOptionalPolling(args, {
        wantSnapshot,
        pollFrames,
        state,
        stop,
      });
      await this.ensureMinimumFrame(args, wantSnapshot, state);
      return { status: 'passed', frames: state.frames };
    } catch (cause) {
      stop.value = true;
      const errorMessage =
        cause instanceof Error ? cause.message : String(cause);
      if (wantSnapshot && state.frames.length === 0) {
        await this.captureFrame(args.snapshot, state).catch(() => undefined);
      }
      return {
        status: 'failed',
        errorMessage,
        cause,
        frames: state.frames,
      };
    }
  }

  private async runWithOptionalPolling(
    args: RecordArgs,
    opts: {
      readonly wantSnapshot: boolean;
      readonly pollFrames: boolean;
      readonly state: FrameCaptureState;
      readonly stop: { value: boolean };
    }
  ): Promise<void> {
    if (opts.wantSnapshot && args.snapshotBefore) {
      await this.captureFrame(args.snapshot, opts.state);
    }
    const pollPromise = this.pollFramesWhile(args, opts);
    try {
      await args.run();
    } finally {
      opts.stop.value = true;
      await pollPromise;
    }
    if (opts.wantSnapshot && !args.snapshotBefore) {
      await this.captureFrame(args.snapshot, opts.state);
    }
  }

  private async pollFramesWhile(
    args: RecordArgs,
    opts: {
      readonly pollFrames: boolean;
      readonly state: FrameCaptureState;
      readonly stop: { value: boolean };
    }
  ): Promise<void> {
    if (!opts.pollFrames) return;
    while (
      !opts.stop.value &&
      opts.state.frames.length < this.maxFramesPerStep
    ) {
      await this.captureFrame(args.snapshot, opts.state);
      if (opts.stop.value) break;
      await delay(this.frameIntervalMs);
    }
  }

  private async ensureMinimumFrame(
    args: RecordArgs,
    wantSnapshot: boolean,
    state: FrameCaptureState
  ): Promise<void> {
    if (!wantSnapshot || state.frames.length > 0) return;
    const html = await args.snapshot({
      stylesheetHref: FRAME_STYLESHEET_HREF,
    });
    if (html == null || html.trim() === '') return;
    state.frames.push(await this.writeFrame(html));
  }

  private async writeFrame(html: string): Promise<SimulationFrame> {
    this.frameSeq += 1;
    return writeReporterFrame({
      store: this.store,
      runId: this.runId,
      testId: this.testId,
      frameSeq: this.frameSeq,
      html,
      currentActorId: this.currentActorId,
      now: this.now,
      attribution: this.attribution,
      writtenDbBlobs: this.writtenDbBlobs,
      ...(this.snapshotViews !== undefined
        ? { snapshotViews: this.snapshotViews }
        : {}),
      ...(this.snapshotDatabases !== undefined
        ? { snapshotDatabases: this.snapshotDatabases }
        : {}),
      ...(this.snapshotCheckpoint !== undefined
        ? { snapshotCheckpoint: this.snapshotCheckpoint }
        : {}),
      ...(this.snapshotEvents !== undefined
        ? { snapshotEvents: this.snapshotEvents }
        : {}),
    });
  }

  private pushStep(
    args: RecordArgs,
    startedAtMs: number,
    endedAtMs: number,
    outcome: StepOutcome
  ): void {
    const last = outcome.frames[outcome.frames.length - 1];
    this.steps.push(
      buildReporterStep({
        index: this.steps.length + 1,
        actorId: args.actorId,
        kind: args.kind,
        title: args.title,
        status: outcome.status,
        startedAtMs,
        endedAtMs,
        frames: outcome.frames,
        ...(args.selector !== undefined ? { selector: args.selector } : {}),
        ...(args.detail !== undefined ? { detail: args.detail } : {}),
        ...(outcome.errorMessage !== undefined
          ? { error: outcome.errorMessage }
          : {}),
        ...(last !== undefined ? { snapshotFile: last.file } : {}),
      })
    );
  }

  private toData(
    endedAtMs: number,
    steps: readonly SimulationStep[] = this.steps
  ): SimulationReportData {
    return buildReporterData({
      seed: this.seed,
      ui: this.ui,
      startedAtMs: this.startedAtMs,
      endedAtMs,
      actorIds: this.actorIds,
      runId: this.runId,
      testId: this.testId,
      sourceFile: this.sourceFile,
      attribution: this.attribution,
      steps,
      ...(this.snapshotTopology !== undefined
        ? { snapshotTopology: this.snapshotTopology }
        : {}),
    });
  }
}
