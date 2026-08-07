import type { SimClientHandle } from './client-factory';
import type { SimClock } from './clock';
import type { SimFaultOptions } from './faults';
import { checkSeqMonotonicity, type InvariantViolation } from './invariants';
import type { SimNetwork } from './network';
import type { SeededRng } from './rng';
import type { SimScheduler } from './scheduler';
import type { SimServer } from './server';
import { BROKER, bootSimKernel, SERVER_HTTP } from './world-boot';
import { addClientImpl, assertConvergedImpl } from './world-ops';

export { SIM_SERVER_NODE_ID } from './clock-skew';

export type SimWorld = {
  readonly seed: bigint;
  readonly clock: SimClock;
  readonly rng: SeededRng;
  readonly scheduler: SimScheduler;
  readonly network: SimNetwork;
  readonly server: SimServer;
  readonly clients: ReadonlyMap<string, SimClientHandle>;
  readonly addClient: (args: {
    readonly id: string;
    readonly actorId?: string;
  }) => Promise<SimClientHandle>;
  readonly crashClient: (id: string) => Promise<void>;
  readonly restartClient: (id: string) => Promise<SimClientHandle>;
  readonly partition: (a: string, b: string) => void;
  readonly healAll: () => void;
  /** Logical wall-clock offset for a client id or {@link SIM_SERVER_NODE_ID}. */
  readonly setClockSkew: (nodeId: string, skewMs: number) => void;
  readonly nowFor: (nodeId: string) => number;
  readonly runFor: (ms: number) => Promise<void>;
  readonly runUntilIdle: (opts?: {
    readonly maxSteps?: number;
    readonly maxVirtualMs?: number;
  }) => Promise<void>;
  readonly checkInvariants: () => Promise<InvariantViolation | null>;
  readonly assertConverged: () => Promise<void>;
  readonly dispose: () => Promise<void>;
};

export type OpenSimWorldArgs = {
  readonly seed: number | bigint | string;
  readonly faults?: SimFaultOptions;
  /** Sample faults from seed when true (overrides faults). */
  readonly sampleFaults?: boolean;
};

async function checkClientSeqs(
  clients: ReadonlyMap<string, SimClientHandle>
): Promise<InvariantViolation | null> {
  for (const c of clients.values()) {
    const seq = await checkSeqMonotonicity(c.db);
    if (seq !== null) return seq;
  }
  return null;
}

/**
 * Multi-client deterministic sync world: virtual clock, lossy network,
 * PGlite server, Bun SQLite clients running real createLocalSyncEngine.
 */
export async function openSimWorld(args: OpenSimWorldArgs): Promise<SimWorld> {
  const k = await bootSimKernel({ seed: args.seed, worldArgs: args });
  const { clients, metas, scheduler, network, server, broker, rng, clockSkew } =
    k;

  const addClient = (clientArgs: {
    readonly id: string;
    readonly actorId?: string;
  }): Promise<SimClientHandle> => addClientImpl(k, clientArgs);

  const crashClient = async (id: string): Promise<void> => {
    const handle = clients.get(id);
    if (handle === undefined) throw new Error(`unknown client ${id}`);
    await handle.dispose();
    clients.delete(id);
  };

  const restartClient = async (id: string): Promise<SimClientHandle> => {
    const meta = metas.get(id);
    if (meta === undefined) throw new Error(`unknown client meta ${id}`);
    if (clients.has(id)) await crashClient(id);
    // Note: in-memory DB is gone — restart is a fresh client (durable crash
    // would need persisting the sqlite file; deferred).
    return addClient({ id: meta.id, actorId: meta.actorId });
  };

  return {
    seed: rng.seed,
    clock: k.clock,
    rng,
    scheduler,
    network,
    server,
    clients,
    addClient,
    crashClient,
    restartClient,
    partition: (a, b) => {
      // Partition each named client from server HTTP + pubsub broker.
      for (const id of [a, b]) {
        network.partition(`http:${id}`, SERVER_HTTP);
        network.partition(`pubsub:${id}`, BROKER);
      }
    },
    healAll: () => network.healAll(),
    setClockSkew: (nodeId, skewMs) => {
      clockSkew.set(nodeId, skewMs);
    },
    nowFor: (nodeId) => k.nowFor(nodeId),
    runFor: (ms) => scheduler.runFor(ms),
    runUntilIdle: (opts) => scheduler.runUntilIdle(opts),
    checkInvariants: () => checkClientSeqs(clients),
    assertConverged: () =>
      assertConvergedImpl({
        network,
        scheduler,
        clients,
        server,
        seed: rng.seed,
      }),
    dispose: async () => {
      for (const c of [...clients.values()]) await c.dispose();
      clients.clear();
      broker.dispose();
      await server.dispose();
    },
  };
}
