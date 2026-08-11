import { join } from 'node:path';
import { wallClock } from '@pkgs/clock';
import { createSimIo, type SimClock, type SimIo } from '@pkgs/io';

import { createSimActor, type SimActor } from './actor';
import type { SimulationOptions } from './options';
import { defaultReportOutDir, SimulationReporter } from './report/reporter';
import type { SimulationReportData } from './report/types';
import { resolveReportOptions } from './report/types';
import type { SimulationSystemHandle, SimulationUiKind } from './system-port';

export type Simulation = {
  readonly seed: bigint;
  readonly io: SimIo;
  readonly clock: SimClock;
  readonly ui: SimulationUiKind;
  /** Absolute path to `index.html` after dispose flush, if reporting enabled. */
  readonly reportPath: string | undefined;
  /** Create (or return cached) actor session with a live UI driver. */
  actor(id: string): Promise<SimActor>;
  /** Human-readable milestone in the report timeline (no-op without reporting). */
  step(label: string, fn: () => Promise<void>): Promise<void>;
  /** Flush report artifacts early; also called from dispose. */
  flushReport(): Promise<SimulationReportData | undefined>;
  dispose(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};

/**
 * Open a multi-actor UI simulation.
 *
 * Tests assert only through each actor's {@link SimActor.ui} driver.
 * The injected {@link SimulationOptions.system} owns the full stack.
 */
export async function openSimulation(
  options: SimulationOptions
): Promise<Simulation> {
  const ui: SimulationUiKind = options.ui ?? 'in-process';
  const io = createSimIo({
    seed: options.seed,
    startMs: options.startMs ?? 0,
  });
  // Derive from parent Io seed — never an independent createSeededRng(seed).
  const rng = io.rng.fork('simulation');
  const handle = await options.system.start({ io, rng, ui });
  const reporter = createReporter(options, io, ui);
  return buildSimulation({ io, ui, handle, reporter });
}

function createReporter(
  options: SimulationOptions,
  io: SimIo,
  ui: SimulationUiKind
): SimulationReporter | undefined {
  const reportOpts = resolveReportOptions(options.report);
  if (reportOpts === null) return undefined;
  const now = () => wallClock.now();
  return new SimulationReporter({
    seed: String(io.seed),
    ui,
    outDir: reportOpts.outDir ?? defaultReportOutDir(String(io.seed), now()),
    now,
  });
}

function buildSimulation(args: {
  readonly io: SimIo;
  readonly ui: SimulationUiKind;
  readonly handle: SimulationSystemHandle;
  readonly reporter: SimulationReporter | undefined;
}): Simulation {
  const { io, ui, handle, reporter } = args;
  const actors = new Map<string, SimActor>();
  let disposed = false;
  let reportPath: string | undefined;

  const flushReport = async (): Promise<SimulationReportData | undefined> => {
    if (!reporter) return undefined;
    const data = await reporter.flush();
    reportPath = reporter.path;
    return data;
  };

  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    const list = [...actors.values()].reverse();
    actors.clear();
    for (const a of list) {
      await a.dispose();
    }
    await handle.dispose();
    const data = await flushReport();
    if (data?.meta.outDir) {
      process.stdout.write(
        `Simulation report: file://${join(data.meta.outDir, 'index.html')}\n`
      );
    }
  };

  return {
    seed: io.seed,
    io,
    clock: io.clock,
    ui,
    get reportPath() {
      return reportPath ?? reporter?.path;
    },
    actor: (id) =>
      getOrCreateActor({ id, disposed, actors, handle, ui, io, reporter }),
    step: (label, fn) => runNamedStep(label, fn, actors, reporter),
    flushReport,
    dispose,
    [Symbol.asyncDispose]: dispose,
  };
}

async function getOrCreateActor(args: {
  readonly id: string;
  readonly disposed: boolean;
  readonly actors: Map<string, SimActor>;
  readonly handle: SimulationSystemHandle;
  readonly ui: SimulationUiKind;
  readonly io: SimIo;
  readonly reporter: SimulationReporter | undefined;
}): Promise<SimActor> {
  if (args.disposed) {
    throw new Error('Simulation.actor: already disposed');
  }
  const existing = args.actors.get(args.id);
  if (existing) return existing;

  const session = await args.handle.createSession(args.id);
  const created = await createSimActor({
    id: args.id,
    session,
    uiKind: args.ui,
    io: args.io,
    ...(args.reporter !== undefined ? { reporter: args.reporter } : {}),
  });
  args.actors.set(args.id, created);
  return created;
}

async function runNamedStep(
  label: string,
  fn: () => Promise<void>,
  actors: Map<string, SimActor>,
  reporter: SimulationReporter | undefined
): Promise<void> {
  if (!reporter) {
    await fn();
    return;
  }
  const actorId = actors.keys().next().value ?? 'sim';
  await reporter.record({
    actorId,
    kind: 'step',
    title: label,
    run: fn,
    snapshot: async () => {
      const first = actors.values().next().value;
      if (!first) return null;
      return first.ui.snapshotHtml();
    },
  });
}
