import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { renderSimulationReportHtml } from './render-report-html';
import type {
  SimulationReportData,
  SimulationReportMeta,
  SimulationStep,
  SimulationStepKind,
  SimulationStepStatus,
} from './types';

export type SimulationReporterOptions = {
  readonly seed: string;
  readonly ui: string;
  readonly outDir: string;
  readonly now: () => number;
};

type RecordArgs = {
  readonly actorId: string;
  readonly kind: SimulationStepKind;
  readonly title: string;
  readonly selector?: string;
  readonly detail?: string;
  readonly run: () => Promise<void>;
  readonly snapshot: () => Promise<string | null>;
  /** Capture snapshot before `run` (e.g. before close unmounts). */
  readonly snapshotBefore?: boolean;
};

type StepOutcome = {
  readonly status: SimulationStepStatus;
  readonly errorMessage?: string;
  readonly cause?: unknown;
  readonly snapshotHtml?: string;
};

/**
 * Collects per-step UI snapshots and writes a Playwright-like HTML report.
 */
export class SimulationReporter {
  private readonly seed: string;
  private readonly ui: string;
  private readonly outDir: string;
  private readonly now: () => number;
  private readonly startedAtMs: number;
  private readonly steps: SimulationStep[] = [];
  private readonly actorIds = new Set<string>();
  private flushed = false;
  private reportPath: string | undefined;

  constructor(options: SimulationReporterOptions) {
    this.seed = options.seed;
    this.ui = options.ui;
    this.outDir = options.outDir;
    this.now = options.now;
    this.startedAtMs = options.now();
  }

  get path(): string | undefined {
    return this.reportPath;
  }

  async record(args: RecordArgs): Promise<void> {
    this.actorIds.add(args.actorId);
    const startedAtMs = this.now();
    const outcome = await runRecorded(args);
    this.pushStep(args, startedAtMs, this.now(), outcome);
    if (outcome.cause !== undefined) {
      throw outcome.cause;
    }
  }

  async flush(): Promise<SimulationReportData> {
    if (this.flushed && this.reportPath) {
      return this.toData(this.now());
    }
    this.flushed = true;
    const endedAtMs = this.now();
    const data = this.toData(endedAtMs);

    await mkdir(join(this.outDir, 'snapshots'), { recursive: true });
    const stepsWithFiles = await writeStepSnapshots(this.outDir, data.steps);
    const finalData: SimulationReportData = {
      meta: data.meta,
      steps: stepsWithFiles,
    };

    await writeFile(
      join(this.outDir, 'steps.json'),
      JSON.stringify(stripSnapshots(finalData), null, 2),
      'utf8'
    );
    await writeFile(
      join(this.outDir, 'index.html'),
      renderSimulationReportHtml(finalData),
      'utf8'
    );

    this.reportPath = join(this.outDir, 'index.html');
    return finalData;
  }

  private pushStep(
    args: RecordArgs,
    startedAtMs: number,
    endedAtMs: number,
    outcome: StepOutcome
  ): void {
    this.steps.push(
      this.buildStep({
        actorId: args.actorId,
        kind: args.kind,
        title: args.title,
        status: outcome.status,
        startedAtMs,
        endedAtMs,
        ...(args.selector !== undefined ? { selector: args.selector } : {}),
        ...(args.detail !== undefined ? { detail: args.detail } : {}),
        ...(outcome.errorMessage !== undefined
          ? { error: outcome.errorMessage }
          : {}),
        ...(outcome.snapshotHtml !== undefined
          ? { snapshotHtml: outcome.snapshotHtml }
          : {}),
      })
    );
  }

  private buildStep(args: {
    readonly actorId: string;
    readonly kind: SimulationStepKind;
    readonly title: string;
    readonly selector?: string;
    readonly detail?: string;
    readonly status: SimulationStepStatus;
    readonly startedAtMs: number;
    readonly endedAtMs: number;
    readonly error?: string;
    readonly snapshotHtml?: string;
  }): SimulationStep {
    const index = this.steps.length + 1;
    return {
      index,
      actorId: args.actorId,
      kind: args.kind,
      title: args.title,
      ...(args.selector !== undefined ? { selector: args.selector } : {}),
      ...(args.detail !== undefined ? { detail: args.detail } : {}),
      status: args.status,
      startedAtMs: args.startedAtMs,
      endedAtMs: args.endedAtMs,
      durationMs: Math.max(0, args.endedAtMs - args.startedAtMs),
      ...(args.error !== undefined ? { error: args.error } : {}),
      ...(args.snapshotHtml !== undefined
        ? { snapshotHtml: args.snapshotHtml }
        : {}),
    };
  }

  private toData(endedAtMs: number): SimulationReportData {
    const status: SimulationStepStatus = this.steps.some(
      (s) => s.status === 'failed'
    )
      ? 'failed'
      : 'passed';
    const meta: SimulationReportMeta = {
      seed: this.seed,
      ui: this.ui,
      startedAtMs: this.startedAtMs,
      endedAtMs,
      durationMs: Math.max(0, endedAtMs - this.startedAtMs),
      status,
      actorIds: [...this.actorIds],
      outDir: this.outDir,
    };
    return { meta, steps: [...this.steps] };
  }
}

async function runRecorded(args: RecordArgs): Promise<StepOutcome> {
  let snapshotHtml: string | undefined;
  try {
    if (args.snapshotBefore) {
      snapshotHtml = (await args.snapshot()) ?? undefined;
    }
    await args.run();
    if (!args.snapshotBefore) {
      snapshotHtml = (await args.snapshot()) ?? undefined;
    }
    return snapshotHtml !== undefined
      ? { status: 'passed', snapshotHtml }
      : { status: 'passed' };
  } catch (cause) {
    const errorMessage = cause instanceof Error ? cause.message : String(cause);
    if (snapshotHtml === undefined) {
      snapshotHtml = (await args.snapshot().catch(() => null)) ?? undefined;
    }
    return snapshotHtml !== undefined
      ? { status: 'failed', errorMessage, cause, snapshotHtml }
      : { status: 'failed', errorMessage, cause };
  }
}

async function writeStepSnapshots(
  outDir: string,
  steps: readonly SimulationStep[]
): Promise<SimulationStep[]> {
  const out: SimulationStep[] = [];
  for (const step of steps) {
    if (step.snapshotHtml === undefined) {
      out.push(step);
      continue;
    }
    const snapshotFile = `snapshots/step-${pad(step.index)}.html`;
    await writeFile(join(outDir, snapshotFile), step.snapshotHtml, 'utf8');
    out.push({ ...step, snapshotFile });
  }
  return out;
}

function pad(index: number): string {
  return String(index).padStart(3, '0');
}

function stripSnapshots(data: SimulationReportData): unknown {
  return {
    meta: data.meta,
    steps: data.steps.map((step) => {
      const { snapshotHtml: _html, ...rest } = step;
      return rest;
    }),
  };
}

export function defaultReportOutDir(seed: string, nowMs: number): string {
  const safeSeed = seed.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return join(process.cwd(), 'simulation-report', `${safeSeed}-${nowMs}`);
}
