import type { SimClientHandle } from './client-factory';
import type { SimClock } from './clock';
import type { SimFaultOptions } from './faults';
import { RELIABLE_FAULTS } from './faults';
import { checkSeqMonotonicity, type InvariantViolation } from './invariants';
import type { SimNetwork } from './network';
import type { SeededRng } from './rng';
import type { SimScheduler } from './scheduler';
import type { SimServer } from './server';
import {
  BROKER,
  liveEndpoint,
  SERVER_HTTP,
  type SimTraffic,
  syncEndpoint,
} from './traffic';
import { bootSimKernel } from './world-boot';
import { addClientImpl, assertConvergedImpl } from './world-ops';

export { SIM_SERVER_NODE_ID } from './clock-skew';
export type { SimTraffic } from './traffic';

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
  /** Drop traffic between this node and the server (default all). */
  readonly partition: (nodeId: string, traffic?: SimTraffic) => void;
  /** Clear partitions for one node. */
  readonly heal: (nodeId: string) => void;
  readonly healAll: () => void;
  readonly hold: (nodeId: string, traffic: SimTraffic) => void;
  readonly release: (nodeId: string, traffic: SimTraffic) => void;
  readonly releaseAll: () => void;
  readonly setFaults: (
    nodeId: string,
    traffic: SimTraffic,
    faults: Partial<SimFaultOptions>
  ) => void;
  readonly clearFaults: (nodeId?: string) => void;
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
  /** When false, pushes wake query refetch instead of row-image apply. */
  readonly rowImageFanout?: boolean;
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

function partitionNode(
  network: SimNetwork,
  nodeId: string,
  traffic: SimTraffic
): void {
  if (traffic === 'sync' || traffic === 'all') {
    network.partition(syncEndpoint(nodeId), SERVER_HTTP);
  }
  if (traffic === 'live' || traffic === 'all') {
    network.partition(liveEndpoint(nodeId), BROKER);
  }
}

function healNode(network: SimNetwork, nodeId: string): void {
  network.heal(syncEndpoint(nodeId), SERVER_HTTP);
  network.heal(liveEndpoint(nodeId), BROKER);
}

/**
 * Multi-client deterministic sync world: virtual clock, lossy network,
 * in-memory SQLite server + clients running real createLocalSyncEngine.
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
    partition: (nodeId, traffic = 'all') => {
      partitionNode(network, nodeId, traffic);
    },
    heal: (nodeId) => {
      healNode(network, nodeId);
    },
    healAll: () => network.healAll(),
    hold: (nodeId, traffic) => {
      network.hold(nodeId, traffic);
    },
    release: (nodeId, traffic) => {
      network.release(nodeId, traffic);
    },
    releaseAll: () => {
      network.releaseAll();
    },
    setFaults: (nodeId, traffic, faults) => {
      network.setNodeFaults(nodeId, traffic, {
        ...RELIABLE_FAULTS,
        ...faults,
      });
    },
    clearFaults: (nodeId) => {
      network.clearNodeFaults(nodeId);
    },
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
