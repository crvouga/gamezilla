import { createSimIo, type SimIo } from '@pkgs/io';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import {
  mintRunId,
  resolveLocalReportDataDir,
  resolveReportOptions,
  type SimulationReportEvent,
  SimulationReporter,
  type SimulationReportTopology,
  sanitizeTestId,
  toRepoRelativePath,
} from '@pkgs/simulation-report';
import type { Driver } from '@pkgs/ui-testing';

import { createSimActor, type SimActor } from './actor';
import { createEventLog, type EventLog } from './events';
import { createFuzzController, type FuzzController } from './fuzz/fuzz-loop';
import { createLiveGraph, type LiveGraph } from './graph/live-graph';
import {
  createSimMesh,
  createSimPubSubBus,
  type SimMesh,
  type SimPubSubBus,
} from './network';
import type { SimulationOptions } from './options';
import type {
  LiveNodeAdapter,
  SimulationSystemHandle,
  SimulationUiKind,
} from './system-port';
import type { TopologyDefinition, TopologySnapshot } from './topology';

export type SimulationHost = {
  tickFuzz(): void;
  adoptActor(id: string, actor: SimActor): void;
};

export type OpenBoot = {
  readonly io: SimIo;
  readonly ui: SimulationUiKind;
  readonly handle: SimulationSystemHandle;
  readonly reporter: SimulationReporter | undefined;
  readonly events: EventLog;
  readonly graph: LiveGraph;
  readonly fuzz: FuzzController;
  readonly pendingActors: Map<string, SimActor>;
  readonly simRef: { current: SimulationHost | null };
  readonly viewsHolder: {
    snapshot: () => Promise<
      readonly { readonly nodeId: string; readonly html: string }[]
    >;
  };
};

/** Build mesh / events / graph / reporter before constructing Simulation. */
export async function prepareOpenBoot(
  options: SimulationOptions
): Promise<OpenBoot> {
  const core = await startSystemCore(options);
  return assembleOpenBoot(options, core);
}

async function startSystemCore(options: SimulationOptions) {
  const ui: SimulationUiKind = options.ui ?? 'in-process';
  const io = createSimIo({
    seed: options.seed,
    startMs: options.startMs ?? 0,
  });
  const rng = io.rng.fork('simulation');
  const meshRng = io.rng.fork('mesh');
  const now = () => io.clock.now();
  const events = createEventLog({ now });
  const mesh = createSimMesh({
    rng: meshRng,
    events,
    now,
    schedule: (fn, ms) => {
      io.timers.setTimeout(fn, ms);
    },
  });
  const pubsub = maybeCreatePubSubBus(options.system.topology, mesh, events);
  const handle = await options.system.start({
    io,
    rng,
    ui,
    mesh,
    events,
    ...(pubsub !== undefined ? { pubsub } : {}),
  });
  return { ui, io, meshRng, events, mesh, handle };
}

function assembleOpenBoot(
  options: SimulationOptions,
  core: Awaited<ReturnType<typeof startSystemCore>>
): OpenBoot {
  const { ui, io, meshRng, events, mesh, handle } = core;
  const fuzzIntensity = options.fuzz?.intensity ?? 0;
  const fuzzSnapshot =
    fuzzIntensity > 0
      ? { enabled: true, intensity: fuzzIntensity, streamId: 'mesh' }
      : null;

  const viewsHolder: OpenBoot['viewsHolder'] = {
    snapshot: async () => [],
  };
  const graphHolder: { current: LiveGraph | null } = { current: null };
  const reporter = createReporter({
    options,
    io,
    ui,
    viewsHolder,
    snapshotDatabases: async () =>
      graphHolder.current?.snapshotDatabases() ?? [],
    events,
    topologySnapshot: () =>
      graphHolder.current?.topologySnapshot() ?? {
        definition: options.system.topology,
        nodes: [],
        edges: [],
        seed: String(io.seed),
        fuzz: fuzzSnapshot,
      },
  });

  const simRef: { current: SimulationHost | null } = { current: null };
  const pendingActors = new Map<string, SimActor>();
  const graph = createLiveGraph({
    definition: options.system.topology,
    system: handle,
    mesh,
    events,
    seed: String(io.seed),
    fuzz: fuzzSnapshot,
    attachUi: (nodeId, adapter) =>
      attachActorUi({
        nodeId,
        adapter,
        ui,
        io,
        events,
        reporter,
        pendingActors,
        simRef,
      }),
  });
  graphHolder.current = graph;

  return {
    io,
    ui,
    handle,
    reporter,
    events,
    graph,
    fuzz: createFuzzController({
      intensity: fuzzIntensity,
      rng: meshRng.fork('fuzz'),
      graph,
      mesh,
      events,
    }),
    pendingActors,
    simRef,
    viewsHolder,
  };
}

async function attachActorUi(ctx: {
  readonly nodeId: string;
  readonly adapter: LiveNodeAdapter;
  readonly ui: SimulationUiKind;
  readonly io: SimIo;
  readonly events: EventLog;
  readonly reporter: SimulationReporter | undefined;
  readonly pendingActors: Map<string, SimActor>;
  readonly simRef: { current: SimulationHost | null };
}): Promise<Driver | undefined> {
  if (!ctx.adapter.session) return undefined;
  const actor = await createSimActor({
    id: ctx.nodeId,
    session: ctx.adapter.session,
    uiKind: ctx.ui,
    io: ctx.io,
    events: ctx.events,
    ...(ctx.reporter !== undefined ? { reporter: ctx.reporter } : {}),
    onDriverOp: () => ctx.simRef.current?.tickFuzz(),
  });
  ctx.pendingActors.set(ctx.nodeId, actor);
  ctx.simRef.current?.adoptActor(ctx.nodeId, actor);
  return actor.ui;
}

function createReporter(args: {
  readonly options: SimulationOptions;
  readonly io: SimIo;
  readonly ui: SimulationUiKind;
  readonly viewsHolder: OpenBoot['viewsHolder'];
  readonly snapshotDatabases: () => Promise<
    readonly { readonly nodeId: string; readonly bytes: Uint8Array }[]
  >;
  readonly events: EventLog;
  readonly topologySnapshot: () => TopologySnapshot;
}): SimulationReporter | undefined {
  const reportOpts = resolveReportOptions(args.options.report);
  if (reportOpts === null) return undefined;
  const now = reportOpts.now ?? (() => args.io.clock.now());
  const seed = String(args.io.seed);
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
    ui: args.ui,
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
    snapshotDatabases: args.snapshotDatabases,
    snapshotViews: () => args.viewsHolder.snapshot(),
    snapshotEvents: () =>
      args.events.snapshot() as readonly SimulationReportEvent[],
    snapshotTopology: () =>
      args.topologySnapshot() as unknown as SimulationReportTopology,
  });
}

function resolveJestSourceFile(): string | null {
  try {
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

function maybeCreatePubSubBus(
  topology: TopologyDefinition,
  mesh: SimMesh,
  events: EventLog
): SimPubSubBus | undefined {
  const broker = topology.nodes.find(
    (n) => n.kind === 'broker' || n.id === 'pubsub'
  );
  if (!broker) return undefined;
  return createSimPubSubBus({
    brokerId: broker.id,
    mesh,
    events,
  });
}
