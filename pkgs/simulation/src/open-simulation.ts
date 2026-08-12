import { createSimIo, type SimClock, type SimIo } from '@pkgs/io';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import {
  mintRunId,
  resolveLocalReportDataDir,
  resolveReportOptions,
  type SimulationReportData,
  SimulationReporter,
  sanitizeTestId,
  toRepoRelativePath,
} from '@pkgs/simulation-report';

import { createSimActor, type SimActor } from './actor';
import type { SimulationOptions } from './options';
import type { SimulationSystemHandle, SimulationUiKind } from './system-port';

/**
 * Multi-actor UI simulation. Open via {@link Simulation.open}; assert only
 * through each actor's {@link SimActor.ui} driver.
 */
export class Simulation {
  readonly seed: bigint;
  readonly io: SimIo;
  readonly clock: SimClock;
  readonly ui: SimulationUiKind;

  private readonly handle: SimulationSystemHandle;
  private readonly reporter: SimulationReporter | undefined;
  private readonly actors = new Map<string, SimActor>();
  private disposed = false;
  private flushedReportPath: string | undefined;

  private constructor(args: {
    readonly io: SimIo;
    readonly ui: SimulationUiKind;
    readonly handle: SimulationSystemHandle;
    readonly reporter: SimulationReporter | undefined;
  }) {
    this.io = args.io;
    this.clock = args.io.clock;
    this.seed = args.io.seed;
    this.ui = args.ui;
    this.handle = args.handle;
    this.reporter = args.reporter;
  }

  /**
   * Open a multi-actor UI simulation.
   *
   * Tests assert only through each actor's {@link SimActor.ui} driver.
   * The injected {@link SimulationOptions.system} owns the full stack.
   */
  static async open(options: SimulationOptions): Promise<Simulation> {
    const ui: SimulationUiKind = options.ui ?? 'in-process';
    const io = createSimIo({
      seed: options.seed,
      startMs: options.startMs ?? 0,
    });
    // Derive from parent Io seed — never an independent createSeededRng(seed).
    const rng = io.rng.fork('simulation');
    const handle = await options.system.start({ io, rng, ui });
    const viewsHolder: {
      snapshot: () => Promise<
        readonly { readonly nodeId: string; readonly html: string }[]
      >;
    } = {
      snapshot: async () => [],
    };
    const reporter = createReporter(options, io, ui, handle, viewsHolder);
    const sim = new Simulation({ io, ui, handle, reporter });
    viewsHolder.snapshot = () => sim.collectActorViews();
    return sim;
  }

  /** Snapshot every mounted actor's UI HTML for report frame views. */
  private async collectActorViews(): Promise<
    readonly { readonly nodeId: string; readonly html: string }[]
  > {
    const out: { nodeId: string; html: string }[] = [];
    for (const [id, actor] of this.actors) {
      try {
        const html = await actor.ui.snapshotHtml({
          stylesheetHref: '../../snapshot-shell.css',
        });
        if (html != null) out.push({ nodeId: id, html });
      } catch {
        // Actor may be mid-dispose / unmounted — skip.
      }
    }
    return out;
  }

  /** Object-store key for this test's `steps.json` after dispose flush, if reporting. */
  get reportPath(): string | undefined {
    return this.flushedReportPath ?? this.reporter?.path;
  }

  /** Create (or return cached) actor session with a live UI driver. */
  async actor(id: string): Promise<SimActor> {
    if (this.disposed) {
      throw new Error('Simulation.actor: already disposed');
    }
    const existing = this.actors.get(id);
    if (existing) return existing;

    const session = await this.handle.createSession(id);
    const created = await createSimActor({
      id,
      session,
      uiKind: this.ui,
      io: this.io,
      ...(this.reporter !== undefined ? { reporter: this.reporter } : {}),
    });
    this.actors.set(id, created);
    return created;
  }

  /** Human-readable milestone in the report timeline (no-op without reporting). */
  async step(label: string, fn: () => Promise<void>): Promise<void> {
    if (!this.reporter) {
      await fn();
      return;
    }
    const actorId = this.actors.keys().next().value ?? 'sim';
    await this.reporter.record({
      actorId,
      kind: 'step',
      title: label,
      pollFrames: true,
      run: fn,
      snapshot: async (options) => {
        const first = this.actors.values().next().value;
        if (!first) return null;
        return first.ui.snapshotHtml(options);
      },
    });
  }

  /** Flush report artifacts early; also called from dispose. */
  async flushReport(): Promise<SimulationReportData | undefined> {
    if (!this.reporter) return undefined;
    const data = await this.reporter.flush();
    this.flushedReportPath = this.reporter.path;
    return data;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    const list = [...this.actors.values()].reverse();
    this.actors.clear();
    for (const a of list) {
      await a.dispose();
    }
    await this.handle.dispose();
    const data = await this.flushReport();
    if (data) {
      process.stdout.write(
        `Simulation report: run=${data.meta.runId} test=${data.meta.testId}\n` +
          `  View: bun run --filter @apps/simulation-report dev\n` +
          `  Open: http://127.0.0.1:7789/b/local/r/${data.meta.runId}/t/${data.meta.testId}\n`
      );
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose();
  }
}

function createReporter(
  options: SimulationOptions,
  io: SimIo,
  ui: SimulationUiKind,
  handle: SimulationSystemHandle,
  viewsHolder: {
    snapshot: () => Promise<
      readonly { readonly nodeId: string; readonly html: string }[]
    >;
  }
): SimulationReporter | undefined {
  const reportOpts = resolveReportOptions(options.report);
  if (reportOpts === null) return undefined;
  const now = reportOpts.now ?? (() => io.clock.now());
  const seed = String(io.seed);
  const store =
    reportOpts.store ??
    createNodeFsObjectStore({
      rootDir: resolveLocalReportDataDir(),
    });
  const runId = reportOpts.runId ?? mintRunId(now());
  const sourceFile =
    reportOpts.sourceFile ?? resolveJestSourceFile() ?? undefined;
  return new SimulationReporter({
    seed,
    ui,
    store,
    runId,
    testId: reportOpts.testId ?? sanitizeTestId(seed),
    now,
    ...(reportOpts.frameIntervalMs !== undefined
      ? { frameIntervalMs: reportOpts.frameIntervalMs }
      : {}),
    ...(reportOpts.maxFramesPerStep !== undefined
      ? { maxFramesPerStep: reportOpts.maxFramesPerStep }
      : {}),
    ...(reportOpts.publishThrottleMs !== undefined
      ? { publishThrottleMs: reportOpts.publishThrottleMs }
      : {}),
    ...(sourceFile !== undefined ? { sourceFile } : {}),
    ...(handle.snapshotDatabases !== undefined
      ? { snapshotDatabases: handle.snapshotDatabases }
      : {}),
    snapshotViews: () => viewsHolder.snapshot(),
  });
}

function resolveJestSourceFile(): string | null {
  try {
    // Jest globals — optional so non-Jest callers stay clean.
    const expectFn = (globalThis as { expect?: { getState?: () => unknown } })
      .expect;
    const state = expectFn?.getState?.() as { testPath?: string } | undefined;
    const testPath = state?.testPath;
    if (typeof testPath !== 'string' || testPath.length === 0) return null;
    return toRepoRelativePath(testPath);
  } catch {
    return null;
  }
}
