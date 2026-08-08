import type { PubSub } from '@pkgs/pubsub/interface';

import { buildSimClient, type SimClientHandle } from './client-factory';
import { createSimHttpClient } from './http-bridge';
import { SERVER_HTTP } from './traffic';
import { fireCrashIfArmed, wireMutateCrashArm } from './world-lifecycle';
import type { AddClientArgs, BootedSimKernel, ClientMeta } from './world-types';

async function waitForSessionSync(
  scheduler: BootedSimKernel['scheduler'],
  handle: SimClientHandle,
  clientId: string
): Promise<void> {
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

function registerClientMeta(
  ctx: BootedSimKernel,
  clientArgs: AddClientArgs
): { readonly actorId: string; readonly deviceId: string } {
  const actorId = clientArgs.actorId ?? clientArgs.id;
  const deviceId = `device:${clientArgs.id}`;
  const prior = ctx.metas.get(clientArgs.id);
  const meta: ClientMeta = {
    id: clientArgs.id,
    actorId,
    deviceId,
    ...(prior?.lastDbBundle !== undefined
      ? { lastDbBundle: prior.lastDbBundle }
      : {}),
  };
  ctx.metas.set(clientArgs.id, meta);
  ctx.authByDevice.set(deviceId, meta);
  if (!ctx.authStatusByDevice.has(deviceId)) {
    ctx.authStatusByDevice.set(deviceId, 'valid');
  }
  return { actorId, deviceId };
}

/** Add a client engine to the world and wait for first sync. */
export async function addClientImpl(
  ctx: BootedSimKernel,
  clientArgs: AddClientArgs
): Promise<SimClientHandle> {
  if (ctx.clients.has(clientArgs.id)) {
    throw new Error(`SimWorld: client ${clientArgs.id} already exists`);
  }
  const { actorId, deviceId } = registerClientMeta(ctx, clientArgs);
  const pubEndpoint = `pubsub:${clientArgs.id}`;
  const clientRng = ctx.rng.fork(`client:${clientArgs.id}`);
  const http = createSimHttpClient({
    network: ctx.network,
    clientId: `http:${clientArgs.id}`,
    serverId: SERVER_HTTP,
    createId: ctx.nextId,
    scheduler: ctx.scheduler,
    onSyncResponseDelivered: async () => {
      await fireCrashIfArmed(
        ctx,
        clientArgs.id,
        'afterNextSyncResponseDelivered'
      );
    },
  });

  let pubsubInstance: PubSub | null = null;
  let remakeCount = 0;
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
      remakeCount += 1;
      pubsubInstance?.close();
      pubsubInstance = ctx.broker.createPubSub(pubEndpoint);
      return pubsubInstance;
    },
    pubsubRemakeCount: () => remakeCount,
    subscribedTopics: () => ctx.broker.subscribedTopics(pubEndpoint),
    rowImageFanout: ctx.worldArgs.rowImageFanout !== false,
    bufferOutboundLive: ctx.worldArgs.bufferOutboundLive === true,
    tableRegistry: clientArgs.localSchema ?? ctx.domain.localSchema,
    mutationRegistry:
      clientArgs.mutationRegistry ?? ctx.domain.mutationRegistry,
    queryRegistry: clientArgs.queryRegistry ?? ctx.domain.queryRegistry,
    sessionQuery: clientArgs.sessionQuery ?? ctx.domain.sessionQuery,
    ...(ctx.domain.createPushChannels !== undefined
      ? { createPushChannels: ctx.domain.createPushChannels }
      : {}),
    faults: ctx.faults,
    ...(clientArgs.schemaEpoch !== undefined
      ? { schemaEpoch: clientArgs.schemaEpoch }
      : {}),
    ...(clientArgs.existingDb !== undefined
      ? { existingDb: clientArgs.existingDb }
      : {}),
    authControl: {
      getStatus: () => ctx.authStatusByDevice.get(deviceId) ?? 'valid',
      refreshExpired: () => {
        if (ctx.authStatusByDevice.get(deviceId) === 'expired') {
          ctx.authStatusByDevice.set(deviceId, 'valid');
        }
      },
    },
  });
  const wrapped = wireMutateCrashArm(ctx, handle);
  ctx.clients.set(clientArgs.id, wrapped);
  await waitForSessionSync(ctx.scheduler, wrapped, clientArgs.id);
  return wrapped;
}
