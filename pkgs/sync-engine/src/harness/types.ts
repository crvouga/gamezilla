import type { VirtualScheduler } from '@pkgs/harness';
import type { SeededRng } from '@pkgs/uuid';
import type { Timers } from '../client/harness-ports';
import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type { HarnessClient, HarnessClientDbBundle } from './client';
import type { HarnessAuthStatus } from './client-factory-parts';
import type { ClockSkewTable } from './clock-skew';
import type { HarnessDomainPack } from './domain-pack';
import type { EdgeFaultController } from './edge-faults';
import type { HarnessFaultOptions } from './faults';
import type { SyncNetwork } from './network';
import type { HarnessPubSubBroker } from './pubsub-bridge';
import type { HarnessServer } from './server';
import type { HarnessServerNode } from './server-cluster';

export type ClientMeta = {
  readonly id: string;
  readonly actorId: string;
  readonly deviceId: string;
  /** Last preserved local DB across crash/failed reopen (epoch-migrate arms). */
  lastDbBundle?: HarnessClientDbBundle;
  /**
   * Last applied domain schema / registries for this client. Preserve-DB
   * restarts reuse these so additive upgrades (extra column/table) are not
   * remigrated against the pack baseline (SQLite refuses undeclared extras).
   */
  lastLocalSchema?: LocalDomainSchema;
  lastMutationRegistry?: MutationRegistry;
  lastQueryRegistry?: QueryRegistry;
  lastSessionQuery?: {
    readonly name: string;
    readonly params: Readonly<Record<string, unknown>>;
  };
  lastSchemaEpoch?: number;
};

export type HarnessClientOpts = {
  readonly faults?: HarnessFaultOptions;
  readonly sampleFaults?: boolean;
  /**
   * When true (and `faults` / `sampleFaults` unset), boot with {@link DST_FAULTS}
   * so scenarios exercise mild reorder/loss by default.
   */
  readonly dstFaults?: boolean;
  /** When false, pushes wake query refetch instead of row-image apply. */
  readonly rowImageFanout?: boolean;
  /**
   * When true, harness pubsub buffers publishes for a peer's last topics while
   * closed and flushes on re-subscribe. Default false = QoS-0 drop.
   */
  readonly liveResendOnReconnect?: boolean;
  /**
   * When true, queue optimistic fanout while push is detached and flush on
   * reconnect. Default false = skip outbound live while disconnected.
   */
  readonly bufferOutboundLive?: boolean;
  /** Injected domain pack (schema, registries, converge). Required. */
  readonly domain: HarnessDomainPack;
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
  readonly existingDb?: HarnessClientDbBundle;
};

/** Virtual clock used by the harness scheduler (see `@pkgs/harness` `VirtualClock`). */
export type HarnessClock = VirtualScheduler['clock'];

/** Clock, network, broker, and in-memory SQLite server for a harness surface. */
export type BootedHarnessKernel = {
  readonly rng: SeededRng;
  readonly clock: HarnessClock;
  readonly clockSkew: ClockSkewTable;
  readonly scheduler: VirtualScheduler;
  readonly timers: Timers;
  readonly network: SyncNetwork;
  server: HarnessServer;
  serverNodes: readonly HarnessServerNode[];
  broker: HarnessPubSubBroker;
  readonly clients: Map<string, HarnessClient>;
  readonly metas: Map<string, ClientMeta>;
  readonly authByDevice: Map<string, ClientMeta>;
  /** Per-device auth token status for expired/revoked scenarios. */
  readonly authStatusByDevice: Map<string, HarnessAuthStatus>;
  readonly storagePressure: import('./storage-pressure').StoragePressureController;
  /** Tab-freeze: sync traffic held while foreground stays true. */
  readonly frozenClients: Set<string>;
  readonly failNextOpenClients: Set<string>;
  readonly nextId: () => string;
  readonly clientOpts: HarnessClientOpts;
  readonly domain: HarnessDomainPack;
  readonly nowFor: (nodeId: string) => number;
  readonly faults: EdgeFaultController;
  unbindHttp: () => void;
  serverPub: ReturnType<HarnessPubSubBroker['createPubSub']>;
};
