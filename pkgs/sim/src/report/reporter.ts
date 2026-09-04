import type { ObjectStore } from '@pkgs/object-store/interface';

import type { CatalogSnapshot } from './define-snapshot';
import { encodeSnapshotValue, padFrame, splitCaptureNodes } from './encode';
import { mediaExtension, testFrameKey, testReportKey } from './keys';
import { persistReport } from './persist';
import type {
  RecordStepMeta,
  ReportFrame,
  ReportSnapshotBlob,
  ReportStep,
  ReportStepStatus,
  RunReport,
  RunReportMeta,
  RunReportOptions,
} from './types';
import { mintRunId, sanitizeRunId, sanitizeTestId } from './types';

type OpenStep = {
  readonly meta: RecordStepMeta;
  readonly startedAtMs: number;
  frames: ReportFrame[];
  lastFrameHash: string;
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
  readonly error?: string;
  readonly cause?: unknown;
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
  private readonly now: () => number;
  private readonly captureApply: boolean;
  private readonly sourceFile: string | undefined;
  private readonly snapshots: readonly CatalogSnapshot<unknown>[];
  private readonly surface: unknown;
  private readonly startedAtMs: number;
  private readonly steps: ReportStep[] = [];
  private readonly actorIds = new Set<string>();
  private open: OpenStep | null = null;
  private frameSeq = 0;
  private flushed = false;
  private status: ReportStepStatus = 'passed';

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
    this.captureApply = (init.options.capture ?? 'apply') === 'apply';
    this.sourceFile = init.options.sourceFile;
    this.snapshots = init.snapshots;
    this.surface = init.surface;
  }

  get shouldCaptureApply(): boolean {
    return this.captureApply && this.open === null;
  }

  async recordApply(args: {
    readonly action: string;
    readonly applyArgs: readonly unknown[];
    readonly run: () => Promise<void>;
  }): Promise<void> {
    const title = formatApplyTitle(args.action, args.applyArgs);
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

  async record(
    meta: RecordStepMeta & {
      readonly action?: string;
      readonly args?: readonly unknown[];
    },
    fn: () => Promise<void>
  ): Promise<void> {
    if (meta.actorId !== undefined) this.actorIds.add(meta.actorId);
    const startedAtMs = this.now();
    const open: OpenStep = {
      meta,
      startedAtMs,
      frames: [],
      lastFrameHash: '',
    };
    const outcome = await this.runOpen(open, meta, fn);
    this.pushClosedStep(meta, startedAtMs, open, outcome);
    if (outcome.cause !== undefined) throw outcome.cause;
  }

  /** Capture registered snapshotters onto the open step, or a synthetic step. */
  async snapshot(): Promise<void> {
    if (this.open !== null) {
      await this.captureOntoOpen(this.open);
      return;
    }
    await this.pushSyntheticSnapshot();
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
        testId: this.testId,
        reportKey: testReportKey(this.runId, this.testId),
        report,
      });
      this.flushed = true;
    }
    return report;
  }

  private async runOpen(
    open: OpenStep,
    meta: RecordStepMeta,
    fn: () => Promise<void>
  ): Promise<StepOutcome> {
    const prev = this.open;
    this.open = open;
    try {
      if (meta.snapshotBefore === true && meta.skipSnapshot !== true) {
        await this.captureOntoOpen(open);
      }
      await fn();
      if (meta.snapshotBefore !== true && meta.skipSnapshot !== true) {
        await this.captureOntoOpen(open);
      }
      return { status: 'passed' };
    } catch (e) {
      this.status = 'failed';
      if (meta.skipSnapshot !== true && open.frames.length === 0) {
        await this.captureOntoOpen(open).catch(() => undefined);
      }
      return {
        status: 'failed',
        error: e instanceof Error ? e.message : String(e),
        cause: e,
      };
    } finally {
      this.open = prev;
    }
  }

  private pushClosedStep(
    meta: RecordStepMeta & {
      readonly action?: string;
      readonly args?: readonly unknown[];
    },
    startedAtMs: number,
    open: OpenStep,
    outcome: StepOutcome
  ): void {
    const endedAtMs = this.now();
    this.steps.push({
      index: this.steps.length + 1,
      kind: meta.kind,
      title: meta.title,
      status: outcome.status,
      startedAtMs,
      endedAtMs,
      durationMs: Math.max(0, endedAtMs - startedAtMs),
      ...(meta.actorId !== undefined ? { actorId: meta.actorId } : {}),
      ...(meta.selector !== undefined ? { selector: meta.selector } : {}),
      ...(meta.detail !== undefined ? { detail: meta.detail } : {}),
      ...(meta.action !== undefined ? { action: meta.action } : {}),
      ...(meta.args !== undefined ? { args: meta.args } : {}),
      ...(outcome.error !== undefined ? { error: outcome.error } : {}),
      frames: open.frames,
    });
  }

  private async pushSyntheticSnapshot(): Promise<void> {
    const startedAtMs = this.now();
    const open: OpenStep = {
      meta: { kind: 'snapshot', title: 'snapshot' },
      startedAtMs,
      frames: [],
      lastFrameHash: '',
    };
    const prev = this.open;
    this.open = open;
    try {
      await this.captureOntoOpen(open);
    } finally {
      this.open = prev;
    }
    this.pushClosedStep(
      { kind: 'snapshot', title: 'snapshot' },
      startedAtMs,
      open,
      { status: 'passed' }
    );
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
      actorIds: [...this.actorIds].sort(),
      ...(this.sourceFile !== undefined ? { sourceFile: this.sourceFile } : {}),
    };
  }

  private async captureOntoOpen(open: OpenStep): Promise<void> {
    if (this.snapshots.length === 0) return;
    const capturedAtMs = this.now();
    const { blobs, frameHash } = await collectSnapshotBlobs({
      snapshots: this.snapshots,
      surface: this.surface,
      store: this.store,
      runId: this.runId,
      testId: this.testId,
      nextSeq: () => {
        this.frameSeq += 1;
        return this.frameSeq;
      },
    });
    if (blobs.length === 0) return;
    if (frameHash === open.lastFrameHash) return;
    open.lastFrameHash = frameHash;
    open.frames.push({
      index: open.frames.length + 1,
      capturedAtMs,
      snapshots: blobs,
    });
  }
}

async function collectSnapshotBlobs(args: {
  readonly snapshots: readonly CatalogSnapshot<unknown>[];
  readonly surface: unknown;
  readonly store: ObjectStore | undefined;
  readonly runId: string;
  readonly testId: string;
  readonly nextSeq: () => number;
}): Promise<{
  readonly blobs: ReportSnapshotBlob[];
  readonly frameHash: string;
}> {
  const blobs: ReportSnapshotBlob[] = [];
  const hashParts: string[] = [];
  for (const snap of args.snapshots) {
    const raw = await snap.capture(args.surface);
    for (const part of splitCaptureNodes(snap.media, raw)) {
      const encoded = encodeSnapshotValue(snap.media, part.value);
      if (encoded === null) continue;
      hashParts.push(`${snap.name}:${part.nodeId ?? ''}:${encoded.hash}`);
      const file = frameFileName({
        seq: args.nextSeq(),
        name: snap.name,
        media: snap.media,
        ...(part.nodeId !== undefined ? { nodeId: part.nodeId } : {}),
      });
      if (args.store !== undefined) {
        await args.store.put(
          testFrameKey(args.runId, args.testId, file),
          encoded.bytes,
          encoded.contentType
        );
      }
      blobs.push({
        name: snap.name,
        media: snap.media,
        file,
        ...(part.nodeId !== undefined ? { nodeId: part.nodeId } : {}),
      });
    }
  }
  return { blobs, frameHash: hashParts.join('|') };
}

function frameFileName(args: {
  readonly seq: number;
  readonly name: string;
  readonly media: string;
  readonly nodeId?: string;
}): string {
  const base = `frames/f-${padFrame(args.seq)}.${sanitizeTestId(args.name)}`;
  const node =
    args.nodeId !== undefined ? `.${sanitizeTestId(args.nodeId)}` : '';
  return `${base}${node}.${mediaExtension(args.media)}`;
}

function formatApplyTitle(
  action: string,
  applyArgs: readonly unknown[]
): string {
  if (action === 'uiOp' && applyArgs.length === 1) {
    const op = applyArgs[0];
    if (typeof op === 'object' && op !== null && 'op' in op) {
      const rec = op as {
        op: string;
        path?: readonly string[];
      };
      const path =
        rec.path !== undefined && rec.path.length > 0
          ? ` testId(${rec.path.join('.')})`
          : '';
      return `${rec.op}${path}`;
    }
  }
  return action;
}

function actorIdFromArgs(applyArgs: readonly unknown[]): string | undefined {
  if (applyArgs.length === 1) {
    const op = applyArgs[0];
    if (
      typeof op === 'object' &&
      op !== null &&
      'actorId' in op &&
      typeof (op as { actorId: unknown }).actorId === 'string'
    ) {
      return (op as { actorId: string }).actorId;
    }
  }
  if (typeof applyArgs[0] === 'string') return applyArgs[0];
  return undefined;
}

function assignFrameDurations(steps: readonly ReportStep[]): ReportStep[] {
  return steps.map((step) => {
    if (step.frames.length === 0) return step;
    const withDurations = step.frames.map((frame, i) => {
      const next = step.frames[i + 1];
      const end = next?.capturedAtMs ?? step.endedAtMs;
      return {
        ...frame,
        durationMs: Math.max(0, end - frame.capturedAtMs),
      };
    });
    return { ...step, frames: withDurations };
  });
}
