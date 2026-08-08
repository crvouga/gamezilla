import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type { SimAuthStatus, SimClientHandle } from './client-factory';
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
import {
  crashClientImpl,
  fireCrashIfArmed,
  type RestartClientOpts,
  type WorldFaultApi,
  worldFaultApi,
} from './world-lifecycle';
import { assertConvergedImpl } from './world-ops';
import { addClientImpl } from './world-ops-add-client';
import { restartClientImpl, restartServerImpl } from './world-restart';
import type { AddClientArgs } from './world-types';

export type {
  SimCrashEvent,
  SimHttpFault,
} from './boundary-faults';
export type { SimAuthStatus } from './client-factory';
export { SIM_SERVER_NODE_ID } from './clock-skew';
export type { SimTraffic } from './traffic';
export type { RestartClientOpts } from './world-lifecycle';

export type SimWorld = {
  readonly seed: bigint;
  readonly clock: SimClock;
  readonly rng: SeededRng;
  readonly scheduler: SimScheduler;
  readonly network: SimNetwork;
  readonly server: SimServer;
  readonly clients: ReadonlyMap<string, SimClientHandle>;
  readonly nextId: () => string;
  readonly addClient: (args: AddClientArgs) => Promise<SimClientHandle>;
  readonly crashClient: (id: string) => Promise<void>;
  readonly restartClient: (
    id: string,
    opts?: RestartClientOpts
  ) => Promise<SimClientHandle>;
  /** Simulate token expired / revoked / valid for a client id. */
  readonly setAuthStatus: (clientId: string, status: SimAuthStatus) => void;
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
  readonly isSchedulerQuiescent: () => boolean;
  readonly checkInvariants: () => Promise<InvariantViolation | null>;
  readonly assertConverged: () => Promise<void>;
  readonly crashServer: () => Promise<void>;
  readonly restartServer: (opts?: {
    readonly preserveDb?: boolean;
  }) => Promise<void>;
  readonly dispose: () => Promise<void>;
} & WorldFaultApi;

export type OpenSimWorldArgs = {
  readonly seed: number | bigint | string;
  readonly faults?: SimFaultOptions;
  /** Sample faults from seed when true (overrides faults). */
  readonly sampleFaults?: boolean;
  /** When false, pushes wake query refetch instead of row-image apply. */
  readonly rowImageFanout?: boolean;
  /**
   * When true, sim pubsub buffers live publishes while a peer is closed and
   * flushes them on re-subscribe. Default false = messages lost on reconnect
   * (QoS-0; repair via sync pull).
   */
  readonly liveResendOnReconnect?: boolean;
  /**
   * When true, queue optimistic fanout while push is detached and flush on
   * reconnect. Default false = peers wait for upload/sync.
   */
  readonly bufferOutboundLive?: boolean;
  /** Domain pack. Default `notes`. Lab uses `shapes`. */
  readonly domain?: 'notes' | 'shapes';
  /** Override domain pack local schema (server + default clients). */
  readonly localSchema?: LocalDomainSchema;
  /** Override domain pack mutation registry (server + default clients). */
  readonly mutationRegistry?: MutationRegistry;
  /** Override domain pack query registry (server + default clients). */
  readonly queryRegistry?: QueryRegistry;
  /** Override domain pack session query. */
  readonly sessionQuery?: {
    readonly name: string;
    readonly params: Readonly<Record<string, unknown>>;
  };
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
  const { clients, metas, scheduler, network, broker, rng, domain, faults } = k;
  const faultApi = worldFaultApi(faults);

  return {
    seed: rng.seed,
    clock: k.clock,
    rng,
    scheduler,
    network,
    get server() {
      return k.server;
    },
    clients,
    nextId: k.nextId,
    addClient: (clientArgs) => addClientImpl(k, clientArgs),
    crashClient: (id) => crashClientImpl(k, id),
    restartClient: (id, opts) => restartClientImpl(k, id, opts),
    setAuthStatus: (clientId, status) => {
      const meta = metas.get(clientId);
      if (meta === undefined) throw new Error(`unknown client ${clientId}`);
      k.authStatusByDevice.set(meta.deviceId, status);
    },
    partition: (nodeId, traffic = 'all') =>
      partitionNode(network, nodeId, traffic),
    heal: (nodeId) => healNode(network, nodeId),
    healAll: () => network.healAll(),
    hold: (nodeId, traffic) => network.hold(nodeId, traffic),
    release: (nodeId, traffic) => network.release(nodeId, traffic),
    releaseAll: () => network.releaseAll(),
    setFaults: (nodeId, traffic, partial) => {
      network.setNodeFaults(nodeId, traffic, {
        ...RELIABLE_FAULTS,
        ...partial,
      });
    },
    clearFaults: (nodeId) => network.clearNodeFaults(nodeId),
    setClockSkew: (nodeId, skewMs) => k.clockSkew.set(nodeId, skewMs),
    nowFor: (nodeId) => k.nowFor(nodeId),
    runFor: (ms) => scheduler.runFor(ms),
    runUntilIdle: (opts) => scheduler.runUntilIdle(opts),
    isSchedulerQuiescent: () => scheduler.pendingCount() === 0,
    checkInvariants: () => checkClientSeqs(clients),
    assertConverged: () =>
      assertConvergedImpl({
        network,
        scheduler,
        clients,
        server: k.server,
        seed: rng.seed,
        domain,
      }),
    crashServer: async () => {
      k.unbindHttp();
    },
    restartServer: (opts) => restartServerImpl(k, opts),
    armCrash: (nodeId, event) => {
      faultApi.armCrash(nodeId, event);
      if (event === 'onNextTimerTickWhileSyncUndelivered') {
        scheduler.scheduleAfter(0, () => {
          void fireCrashIfArmed(k, nodeId, event);
        });
      }
    },
    clearCrashArms: faultApi.clearCrashArms,
    armHttpFault: faultApi.armHttpFault,
    clearHttpFaults: faultApi.clearHttpFaults,
    armPublishFault: faultApi.armPublishFault,
    clearPublishFault: faultApi.clearPublishFault,
    dispose: async () => {
      for (const c of [...clients.values()]) await c.dispose();
      clients.clear();
      k.unbindHttp();
      broker.dispose();
      await k.server.dispose();
    },
  };
}
