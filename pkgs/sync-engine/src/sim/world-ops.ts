import type { PubSub } from '@pkgs/pubsub/interface';

import type { Timers } from '../client/sim-ports';
import { buildSimClient, type SimClientHandle } from './client-factory';
import type { SimClock } from './clock';
import type { SimFaultOptions } from './faults';
import { createSimHttpClient } from './http-bridge';
import type { SimNetwork } from './network';
import type { SimPubSubBroker } from './pubsub-bridge';
import type { SeededRng } from './rng';
import type { SimScheduler } from './scheduler';
import type { SimServer } from './server';
import { assertConvergedImpl, type AssertConvergedCtx } from './world-converge';

export type { AssertConvergedCtx };
export { assertConvergedImpl };

export type ClientMeta = {
  readonly id: string;
  readonly actorId: string;
  readonly deviceId: string;
};

export type WorldClientOpts = {
  readonly fallbackPollMs?: number;
  readonly reconcileMs?: number;
  readonly faults?: SimFaultOptions;
  readonly sampleFaults?: boolean;
};

const SERVER_HTTP = 'http:server';

export type AddClientCtx = {
  readonly worldArgs: WorldClientOpts;
  readonly rng: SeededRng;
  readonly clock: SimClock;
  readonly scheduler: SimScheduler;
  readonly timers: Timers;
  readonly network: SimNetwork;
  readonly server: SimServer;
  readonly broker: SimPubSubBroker;
  readonly clients: Map<string, SimClientHandle>;
  readonly metas: Map<string, ClientMeta>;
  readonly authByDevice: Map<string, ClientMeta>;
  readonly nextId: () => string;
};

async function waitForBoot(
  scheduler: SimScheduler,
  handle: SimClientHandle,
  clientId: string
): Promise<void> {
  // Flush microtasks so fetchOnce reaches postQuery and schedules HTTP.
  await Promise.resolve();
  await Promise.resolve();
  let booted = false;
  const boot = handle.engine.waitForFirstSync().then(() => {
    booted = true;
  });
  const ok = await scheduler.runUntil(() => booted, {
    maxVirtualMs: 30_000,
    maxSteps: 50_000,
  });
  if (!ok) {
    throw new Error(`SimWorld: boot sync timeout for ${clientId}`);
  }
  await boot;
}

/** Add a client engine to the world and wait for first sync. */
export async function addClientImpl(
  ctx: AddClientCtx,
  clientArgs: { readonly id: string; readonly actorId?: string }
): Promise<SimClientHandle> {
  if (ctx.clients.has(clientArgs.id)) {
    throw new Error(`SimWorld: client ${clientArgs.id} already exists`);
  }
  const actorId = clientArgs.actorId ?? clientArgs.id;
  const deviceId = `device:${clientArgs.id}`;
  const meta: ClientMeta = { id: clientArgs.id, actorId, deviceId };
  ctx.metas.set(clientArgs.id, meta);
  ctx.authByDevice.set(deviceId, meta);

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
    now: () => ctx.clock.now(),
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
    ...(ctx.worldArgs.fallbackPollMs !== undefined
      ? { fallbackPollMs: ctx.worldArgs.fallbackPollMs }
      : {}),
    ...(ctx.worldArgs.reconcileMs !== undefined
      ? { reconcileMs: ctx.worldArgs.reconcileMs }
      : {}),
  });
  ctx.clients.set(clientArgs.id, handle);
  await waitForBoot(ctx.scheduler, handle, clientArgs.id);
  return handle;
}
