import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { Timers } from '../client/sim-ports';
import type { MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type { BoundaryFaultController } from './boundary-faults';
import type { SimAuthStatus } from './client-factory-parts';
import type { SimClientDbBundle, SimClientHandle } from './client-handle';
import type { SimClock } from './clock';
import type { ClockSkewTable } from './clock-skew';
import type { SimDomainPack } from './domain-pack';
import type { SimFaultOptions } from './faults';
import type { SimNetwork } from './network';
import type { SimPubSubBroker } from './pubsub-bridge';
import type { SeededRng } from './rng';
import type { SimScheduler } from './scheduler';
import type { SimServer } from './server';

export type ClientMeta = {
  readonly id: string;
  readonly actorId: string;
  readonly deviceId: string;
  /** Last preserved local DB across crash/failed reopen (epoch-migrate arms). */
  lastDbBundle?: SimClientDbBundle;
};

export type WorldClientOpts = {
  readonly faults?: SimFaultOptions;
  readonly sampleFaults?: boolean;
  /**
   * When true (and `faults` / `sampleFaults` unset), boot with {@link DST_FAULTS}
   * so scenarios exercise mild reorder/loss by default.
   */
  readonly dstFaults?: boolean;
  /** When false, pushes wake query refetch instead of row-image apply. */
  readonly rowImageFanout?: boolean;
  /**
   * When true, sim pubsub buffers publishes for a peer's last topics while
   * closed and flushes on re-subscribe. Default false = QoS-0 drop.
   */
  readonly liveResendOnReconnect?: boolean;
  /**
   * When true, queue optimistic fanout while push is detached and flush on
   * reconnect. Default false = skip outbound live while disconnected.
   */
  readonly bufferOutboundLive?: boolean;
  /** Injected domain pack (schema, registries, converge). Required. */
  readonly domain: SimDomainPack;
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

export type AddClientArgs = {
  readonly id: string;
  readonly actorId?: string;
  readonly sessionQuery?: {
    readonly name: string;
    readonly params: Readonly<Record<string, unknown>>;
  };
  readonly localSchema?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
  readonly schemaEpoch?: number;
  readonly existingDb?: SimClientDbBundle;
};

/** Clock, network, broker, and in-memory SQLite server for a sim world. */
export type BootedSimKernel = {
  readonly rng: SeededRng;
  readonly clock: SimClock;
  readonly clockSkew: ClockSkewTable;
  readonly scheduler: SimScheduler;
  readonly timers: Timers;
  readonly network: SimNetwork;
  server: SimServer;
  readonly broker: SimPubSubBroker;
  readonly clients: Map<string, SimClientHandle>;
  readonly metas: Map<string, ClientMeta>;
  readonly authByDevice: Map<string, ClientMeta>;
  /** Per-device auth token status for expired/revoked scenarios. */
  readonly authStatusByDevice: Map<string, SimAuthStatus>;
  readonly nextId: () => string;
  readonly worldArgs: WorldClientOpts;
  readonly domain: SimDomainPack;
  readonly nowFor: (nodeId: string) => number;
  readonly faults: BoundaryFaultController;
  unbindHttp: () => void;
  serverPub: ReturnType<SimPubSubBroker['createPubSub']>;
};
