import type { PubSub } from '@pkgs/pubsub/interface';

import type { Timers } from '../client/sim-ports';
import { buildSimClient, type SimClientHandle } from './client-factory';
import type { SimClock } from './clock';
import type { SimDomainPack } from './domain-pack';
import type { SimFaultOptions } from './faults';
import { createSimHttpClient } from './http-bridge';
import type { SimNetwork } from './network';
import type { SimPubSubBroker } from './pubsub-bridge';
import type { SeededRng } from './rng';
import type { SimScheduler } from './scheduler';
import type { SimServer } from './server';
import { SERVER_HTTP } from './traffic';
import { type AssertConvergedCtx, assertConvergedImpl } from './world-converge';

export type { AssertConvergedCtx };
export { assertConvergedImpl };

export type ClientMeta = {
  readonly id: string;
  readonly actorId: string;
  readonly deviceId: string;
};

export type WorldClientOpts = {
  readonly faults?: SimFaultOptions;
  readonly sampleFaults?: boolean;
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
  /** Domain pack id. Default `notes`. Lab uses `shapes`. */
  readonly domain?: 'notes' | 'shapes';
};

export type AddClientCtx = {
  readonly worldArgs: WorldClientOpts;
  readonly domain: SimDomainPack;
  readonly rng: SeededRng;
  readonly clock: SimClock;
  readonly nowFor: (nodeId: string) => number;
  readonly scheduler: SimScheduler;
  readonly timers: Timers;
  readonly network: SimNetwork;
  readonly server: SimServer;
  readonly broker: SimPubSubBroker;
  readonly clients: Map<string, SimClientHandle>;
  readonly metas: Map<string, ClientMeta>;
  readonly authByDevice: Map<string, ClientMeta>;
  readonly authStatusByDevice: Map<
    string,
    import('./client-factory').SimAuthStatus
  >;
  readonly nextId: () => string;
};

export type AddClientArgs = {
  readonly id: string;
  readonly actorId?: string;
  readonly sessionQuery?: {
    readonly name: string;
    readonly params: Readonly<Record<string, unknown>>;
  };
};

async function waitForSessionSync(
  scheduler: SimScheduler,
  handle: SimClientHandle,
  clientId: string
): Promise<void> {
  // Flush coalescing so the session-query batch reaches HTTP.
  await Promise.resolve();
  await Promise.resolve();
  let synced = false;
  const sessionSync = handle.engine.waitForFirstSync().then(() => {
    synced = true;
  });
  const ok = await scheduler.runUntil(() => synced, {
    maxVirtualMs: 30_000,
    maxSteps: 50_000,
  });
  if (!ok) {
    throw new Error(`SimWorld: session sync timeout for ${clientId}`);
  }
  await sessionSync;
}

/** Add a client engine to the world and wait for first sync. */
export async function addClientImpl(
  ctx: AddClientCtx,
  clientArgs: AddClientArgs
): Promise<SimClientHandle> {
  if (ctx.clients.has(clientArgs.id)) {
    throw new Error(`SimWorld: client ${clientArgs.id} already exists`);
  }
  const actorId = clientArgs.actorId ?? clientArgs.id;
  const deviceId = `device:${clientArgs.id}`;
  const meta: ClientMeta = { id: clientArgs.id, actorId, deviceId };
  ctx.metas.set(clientArgs.id, meta);
  ctx.authByDevice.set(deviceId, meta);
  if (!ctx.authStatusByDevice.has(deviceId)) {
    ctx.authStatusByDevice.set(deviceId, 'valid');
  }

  const httpEndpoint = `http:${clientArgs.id}`;
  const pubEndpoint = `pubsub:${clientArgs.id}`;
  const clientRng = ctx.rng.fork(`client:${clientArgs.id}`);
  const http = createSimHttpClient({
    network: ctx.network,
    clientId: httpEndpoint,
    serverId: SERVER_HTTP,
    createId: ctx.nextId,
    scheduler: ctx.scheduler,
  });

  let pubsubInstance: PubSub | null = null;
  const handle = await buildSimClient({
    id: clientArgs.id,
    actorId,
    deviceId,
    now: () => ctx.nowFor(clientArgs.id),
    random: () => clientRng.random(),
    timers: ctx.timers,
    createId: ctx.nextId,
    http,
    server: ctx.server,
    auth: {
      actorId,
      deviceId,
      accountId: `acct:${actorId}`,
      isAnon: false,
    },
    createPubSub: () => {
      pubsubInstance?.close();
      pubsubInstance = ctx.broker.createPubSub(pubEndpoint);
      return pubsubInstance;
    },
    rowImageFanout: ctx.worldArgs.rowImageFanout !== false,
    bufferOutboundLive: ctx.worldArgs.bufferOutboundLive === true,
    tableRegistry: ctx.domain.localSchema,
    mutationRegistry: ctx.domain.mutationRegistry,
    queryRegistry: ctx.domain.queryRegistry,
    sessionQuery: clientArgs.sessionQuery ?? ctx.domain.sessionQuery,
    authControl: {
      getStatus: () => ctx.authStatusByDevice.get(deviceId) ?? 'valid',
      refreshExpired: () => {
        if (ctx.authStatusByDevice.get(deviceId) === 'expired') {
          ctx.authStatusByDevice.set(deviceId, 'valid');
        }
      },
    },
  });
  ctx.clients.set(clientArgs.id, handle);
  await waitForSessionSync(ctx.scheduler, handle, clientArgs.id);
  return handle;
}
