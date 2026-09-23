import type { ObjectStore } from '@pkgs/object-store/interface';

import { captureSnapshotParts, persistSnapshotParts } from './capture';
import type { CatalogSnapshot } from './define-snapshot';
import {
  actorIdFromArgs,
  errorMessage,
  errorStack,
  formatApplyTitle,
} from './format-title';
import { testReportKey } from './keys';
import { persistReport } from './persist';
import type {
  RecordStepMeta,
  ReportFrame,
  ReportSnapshotBlob,
  ReportStep,
  ReportStepHit,
  ReportStepStatus,
  ReportTestStatus,
  RunReport,
  RunReportMeta,
  RunReportOptions,
} from './types';
import { mintRunId, sanitizeRunId, sanitizeTestId } from './types';

type OpenStep = {
  readonly meta: RecordStepMeta;
  readonly startedAtMs: number;
  readonly frames: ReportFrame[];
  readonly steps: ReportStep[];
};

type ReporterInit = {
  readonly system: string;
  readonly runtime: string;
  readonly seed: string;
  readonly options: RunReportOptions;
  readonly snapshots: readonly CatalogSnapshot<unknown>[];
  readonly surface: unknown;
  readonly sessionNow: () => number;
};

type StepOutcome = {
  readonly status: ReportStepStatus;
  readonly cause?: unknown;
};

type ApplyStepMeta = RecordStepMeta & {
  readonly action?: string;
  readonly args?: readonly unknown[];
};

/**
 * Collects report steps/frames during a Run. In-memory always;
 * persists to ObjectStore when `options.store` is set.
 */
export class RunReporter {
  private readonly system: string;
  private readonly runtime: string;
  private readonly seed: string;
  private readonly store: ObjectStore | undefined;
  private readonly runId: string;
  private readonly testId: string;
  private readonly title: string;
  private readonly now: () => number;
  private readonly captureApply: boolean;
  private readonly sourceFile: string | undefined;
  private readonly sourceLine: number | undefined;
  private readonly snapshots: readonly CatalogSnapshot<unknown>[];
  private readonly surface: unknown;
  private readonly startedAtMs: number;
  private readonly steps: ReportStep[] = [];
  private readonly actorIds = new Set<string>();
  private open: OpenStep | null = null;
  private frameSeq = 0;
  private lastFrameHash = '';
  private lastBlobs: readonly ReportSnapshotBlob[] = [];
  private flushed = false;
  private status: ReportTestStatus = 'passed';
  private failure: { readonly error: string; readonly stack?: string } | null =
    null;

  constructor(init: ReporterInit) {
    this.system = init.system;
    this.runtime = init.runtime;
    this.seed = init.seed;
    this.store = init.options.store;
    this.now = init.options.now ?? init.sessionNow;
    this.startedAtMs = this.now();
    this.runId = sanitizeRunId(
      init.options.runId ?? mintRunId(this.startedAtMs)
    );
    this.testId = sanitizeTestId(init.options.testId ?? init.system);
    this.title = init.options.title ?? this.testId;
    this.captureApply = (init.options.capture ?? 'apply') === 'apply';
    this.sourceFile = init.options.sourceFile;
    this.sourceLine = init.options.sourceLine;
    this.snapshots = init.snapshots;
    this.surface = init.surface;
  }

  get shouldCaptureApply(): boolean {
    return this.captureApply;
  }

  async recordApply(args: {
    readonly action: string;
    readonly applyArgs: readonly unknown[];
    readonly describe: ((...a: unknown[]) => string) | undefined;
    readonly run: () => Promise<void>;
  }): Promise<void> {
    const title =
      args.describe !== undefined
        ? args.describe(...args.applyArgs)
        : formatApplyTitle(args.action, args.applyArgs);
    const actorId = actorIdFromArgs(args.applyArgs);
    await this.record(
      {
        kind: 'apply',
        title,
        ...(actorId !== undefined ? { actorId } : {}),
        action: args.action,
        args: args.applyArgs,
      },
      args.run
    );
  }

  async record(meta: ApplyStepMeta, fn: () => Promise<void>): Promise<void> {
    if (meta.actorId !== undefined) this.actorIds.add(meta.actorId);
    const open: OpenStep = {
      meta,
      startedAtMs: this.now(),
      frames: [],
      steps: [],
    };
    const outcome = await this.runOpen(open, fn);
    this.pushClosedStep(meta, open, outcome);
    if (outcome.cause !== undefined) throw outcome.cause;
  }

  /** Capture registered snapshotters onto the open step, or a synthetic step. */
  async snapshot(): Promise<void> {
    if (this.open !== null) {
      await this.captureOntoOpen(this.open);
      return;
    }
    await this.record(
      { kind: 'snapshot', title: 'snapshot', snapshotBefore: true },
      () => Promise.resolve()
    );
  }

  /** Record a failure raised outside any step (dispose checks, harness). */
  markFailed(cause: unknown): void {
    this.status = 'failed';
    if (this.failure === null) {
      const stack = errorStack(cause);
      this.failure = {
        error: errorMessage(cause),
        ...(stack !== undefined ? { stack } : {}),
      };
    }
  }

  toReport(endedAtMs?: number): RunReport {
    const end = endedAtMs ?? this.now();
    return {
      meta: this.buildMeta(end),
      steps: assignFrameDurations(this.steps),
    };
  }

  async flush(): Promise<RunReport> {
    const report = this.toReport();
    if (this.store !== undefined && !this.flushed) {
      await persistReport({
        store: this.store,
        runId: this.runId,
        reportKey: testReportKey(this.runId, this.testId),
        report,
      });
      this.flushed = true;
    }
    return report;
  }

  private async runOpen(
    open: OpenStep,
    fn: () => Promise<void>
  ): Promise<StepOutcome> {
    const { meta } = open;
    const prev = this.open;
    this.open = open;
    try {
      if (meta.snapshotBefore === true && meta.skipSnapshot !== true) {
        await this.captureOntoOpen(open, meta.hit);
      }
      await fn();
      if (meta.snapshotBefore !== true && meta.skipSnapshot !== true) {
        await this.captureOntoOpen(open);
      }
      return { status: 'passed' };
    } catch (e) {
      this.markFailed(e);
      if (meta.skipSnapshot !== true) {
        await this.captureOntoOpen(open).catch(() => undefined);
      }
      return { status: 'failed', cause: e };
    } finally {
      this.open = prev;
    }
  }

  private pushClosedStep(
    meta: ApplyStepMeta,
    open: OpenStep,
    outcome: StepOutcome
  ): void {
    const endedAtMs = this.now();
    const siblings = this.open === null ? this.steps : this.open.steps;
    const stack = errorStack(outcome.cause);
    siblings.push({
      index: siblings.length + 1,
      kind: meta.kind,
      title: meta.title,
      status: outcome.status,
      startedAtMs: open.startedAtMs,
      endedAtMs,
      durationMs: Math.max(0, endedAtMs - open.startedAtMs),
      ...(meta.actorId !== undefined ? { actorId: meta.actorId } : {}),
      ...(meta.selector !== undefined ? { selector: meta.selector } : {}),
      ...(meta.detail !== undefined ? { detail: meta.detail } : {}),
      ...(meta.action !== undefined ? { action: meta.action } : {}),
      ...(meta.args !== undefined ? { args: meta.args } : {}),
      ...(outcome.cause !== undefined
        ? { error: errorMessage(outcome.cause) }
        : {}),
      ...(stack !== undefined ? { errorStack: stack } : {}),
      frames: open.frames,
      steps: open.steps,
    });
  }

  private buildMeta(endedAtMs: number): RunReportMeta {
    return {
      system: this.system,
      runtime: this.runtime,
      seed: this.seed,
      startedAtMs: this.startedAtMs,
      endedAtMs,
      durationMs: Math.max(0, endedAtMs - this.startedAtMs),
      status: this.status,
      runId: this.runId,
      testId: this.testId,
      title: this.title,
      actorIds: [...this.actorIds].sort(),
      ...(this.sourceFile !== undefined ? { sourceFile: this.sourceFile } : {}),
      ...(this.sourceLine !== undefined ? { sourceLine: this.sourceLine } : {}),
      ...(this.failure !== null ? { error: this.failure.error } : {}),
      ...(this.failure?.stack !== undefined
        ? { errorStack: this.failure.stack }
        : {}),
    };
  }

  private async captureOntoOpen(
    open: OpenStep,
    hit?: ReportStepHit
  ): Promise<void> {
    if (this.snapshots.length === 0) return;
    const capturedAtMs = this.now();
    const { parts, frameHash } = await captureSnapshotParts(
      this.snapshots,
      this.surface
    );
    if (parts.length === 0) return;
    if (frameHash === this.lastFrameHash) {
      // Unchanged UI: reuse the stored blobs so a press still gets its own
      // frame to show the target on; otherwise skip the duplicate.
      if (hit !== undefined && this.lastBlobs.length > 0) {
        this.pushFrame(open, capturedAtMs, this.lastBlobs, hit);
      }
      return;
    }
    this.lastFrameHash = frameHash;
    const blobs = await persistSnapshotParts({
      parts,
      store: this.store,
      runId: this.runId,
      testId: this.testId,
      nextSeq: () => {
        this.frameSeq += 1;
        return this.frameSeq;
      },
    });
    this.lastBlobs = blobs;
    this.pushFrame(open, capturedAtMs, blobs, hit);
  }

  private pushFrame(
    open: OpenStep,
    capturedAtMs: number,
    snapshots: readonly ReportSnapshotBlob[],
    hit: ReportStepHit | undefined
  ): void {
    open.frames.push({
      index: open.frames.length + 1,
      capturedAtMs,
      snapshots,
      ...(hit !== undefined ? { hit } : {}),
    });
  }
}

function assignFrameDurations(steps: readonly ReportStep[]): ReportStep[] {
  return steps.map((step) => {
    const nested = assignFrameDurations(step.steps);
    if (step.frames.length === 0) return { ...step, steps: nested };
    const frames = step.frames.map((frame, i) => {
      const next = step.frames[i + 1];
      const end = next?.capturedAtMs ?? step.endedAtMs;
      return { ...frame, durationMs: Math.max(0, end - frame.capturedAtMs) };
    });
    return { ...step, frames, steps: nested };
  });
}
