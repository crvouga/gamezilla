import type { SimClock, SimIo } from '@pkgs/io';
import type {
  SimulationReportData,
  SimulationReporter,
} from '@pkgs/simulation-report';

import type { SimActor } from './actor';
import type { EventLog } from './events';
import type { FuzzController } from './fuzz/fuzz-loop';
import type { LiveGraph } from './graph/live-graph';
import type { SimEdgeHandle, SimNodeHandle } from './handles';
import { prepareOpenBoot } from './open-simulation-boot';
import type { SimulationOptions } from './options';
import type { SimulationSystemHandle, SimulationUiKind } from './system-port';
import type { TopologySnapshot } from './topology';

/**
 * Topology-aware multi-actor UI simulation. Open via {@link Simulation.open};
 * assert through {@link actor} UI drivers or inspect {@link node} / {@link edge}.
 */
export class Simulation {
  readonly seed: bigint;
  readonly io: SimIo;
  readonly clock: SimClock;
  readonly ui: SimulationUiKind;

  private readonly handle: SimulationSystemHandle;
  private readonly reporter: SimulationReporter | undefined;
  private readonly events: EventLog;
  private readonly graph: LiveGraph;
  private readonly actors = new Map<string, SimActor>();
  private readonly fuzz: FuzzController;
  private disposed = false;
  private flushedReportPath: string | undefined;

  private constructor(args: {
    readonly io: SimIo;
    readonly ui: SimulationUiKind;
    readonly handle: SimulationSystemHandle;
    readonly reporter: SimulationReporter | undefined;
    readonly events: EventLog;
    readonly graph: LiveGraph;
    readonly fuzz: FuzzController;
  }) {
    this.io = args.io;
    this.clock = args.io.clock;
    this.seed = args.io.seed;
    this.ui = args.ui;
    this.handle = args.handle;
    this.reporter = args.reporter;
    this.events = args.events;
    this.graph = args.graph;
    this.fuzz = args.fuzz;
  }

  static async open(options: SimulationOptions): Promise<Simulation> {
    const boot = await prepareOpenBoot(options);
    const sim = new Simulation({
      io: boot.io,
      ui: boot.ui,
      handle: boot.handle,
      reporter: boot.reporter,
      events: boot.events,
      graph: boot.graph,
      fuzz: boot.fuzz,
    });
    boot.simRef.current = sim;
    for (const [id, actor] of boot.pendingActors) {
      sim.adoptActor(id, actor);
    }
    await boot.graph.ensureStaticNodes();
    for (const [id, actor] of boot.pendingActors) {
      sim.adoptActor(id, actor);
    }
    boot.viewsHolder.snapshot = () => boot.graph.collectHtmlViews();
    return sim;
  }

  /** Wire a spawned UI actor into this simulation (boot / attachUi). */
  adoptActor(id: string, actor: SimActor): void {
    this.actors.set(id, actor);
  }

  /** Advance fuzz controller one tick (driver ops / boot hooks). */
  tickFuzz(): void {
    void this.fuzz.tick();
  }

  /** Topology snapshot for reports / debugging. */
  topology(): TopologySnapshot {
    return this.graph.topologySnapshot();
  }

  /** Fine-grained event log snapshot. */
  eventLog() {
    return this.events.snapshot();
  }

  node(id: string): SimNodeHandle {
    return this.graph.node(id);
  }

  edge(from: string, to: string): SimEdgeHandle {
    return this.graph.edge(from, to);
  }

  get reportPath(): string | undefined {
    return this.flushedReportPath ?? this.reporter?.path;
  }

  /** Spawn/get an html node and return its UI actor (sugar over {@link node}). */
  async actor(id: string): Promise<SimActor> {
    if (this.disposed) {
      throw new Error('Simulation.actor: already disposed');
    }
    const existing = this.actors.get(id);
    if (existing) return existing;

    const kind = this.graph.actorKind();
    await this.graph.spawn(id, kind);
    const actor = this.actors.get(id);
    if (!actor) {
      throw new Error(
        `Simulation.actor: node '${id}' spawned without UI session`
      );
    }
    return actor;
  }

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
    this.events.append({
      kind: 'ui.step',
      nodeId: actorId,
      title: label,
    });
  }

  async flushReport(): Promise<SimulationReportData | undefined> {
    if (!this.reporter) return undefined;
    const data = await this.reporter.flush();
    this.flushedReportPath = this.reporter.path;
    return data;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    // Flush while the live graph still has nodes (topology.json / sqlite).
    const data = await this.flushReport();
    const list = [...this.actors.values()].reverse();
    this.actors.clear();
    for (const a of list) {
      try {
        await a.dispose();
      } catch {
        // ignore
      }
    }
    await this.graph.dispose();
    await this.handle.dispose();
    if (data) {
      process.stdout.write(
        `Simulation report: run=${data.meta.runId} test=${data.meta.testId}\n` +
          `  View: bun run --filter @apps/simulation-report dev\n` +
          `  Open: http://127.0.0.1:7789/b/local/r/${data.meta.runId}/t/${data.meta.testId}\n` +
          `  Replay with seed ${data.meta.seed}\n`
      );
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose();
  }
}
