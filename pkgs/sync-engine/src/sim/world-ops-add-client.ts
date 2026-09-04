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
    throw new Error(`World: session sync timeout for ${clientId}`);
  }
  await sessionSync;
}

function pickCarry<T>(
  next: T | undefined,
  prior: T | undefined
): { readonly value: T } | undefined {
  if (next !== undefined) return { value: next };
  if (prior !== undefined) return { value: prior };
  return undefined;
}

type StickySchemaArgs = Pick<
  AddClientArgs,
  | 'localSchema'
  | 'mutationRegistry'
  | 'queryRegistry'
  | 'sessionQuery'
  | 'schemaEpoch'
>;

/**
 * Peer engines that share a donor DB must remigrate with the donor's sticky
 * upgrade schema. Pack baseline rejects leftover extras (e.g. notes.color).
 */
function stickyFromSharedDb(
  ctx: BootedSimKernel,
  existingDb: AddClientArgs['existingDb']
): StickySchemaArgs {
  if (existingDb === undefined) return {};
  for (const [id, handle] of ctx.clients) {
    if (handle.dbBundle.serial !== existingDb.serial) continue;
    const meta = ctx.metas.get(id);
    if (meta === undefined) return {};
    return {
      ...(meta.lastLocalSchema !== undefined
        ? { localSchema: meta.lastLocalSchema }
        : {}),
      ...(meta.lastMutationRegistry !== undefined
        ? { mutationRegistry: meta.lastMutationRegistry }
        : {}),
      ...(meta.lastQueryRegistry !== undefined
        ? { queryRegistry: meta.lastQueryRegistry }
        : {}),
      ...(meta.lastSessionQuery !== undefined
        ? { sessionQuery: meta.lastSessionQuery }
        : {}),
      ...(meta.lastSchemaEpoch !== undefined
        ? { schemaEpoch: meta.lastSchemaEpoch }
        : {}),
    };
  }
  return {};
}

function withSharedDbSticky(
  ctx: BootedSimKernel,
  clientArgs: AddClientArgs
): AddClientArgs {
  const sticky = stickyFromSharedDb(ctx, clientArgs.existingDb);
  return {
    ...clientArgs,
    localSchema: clientArgs.localSchema ?? sticky.localSchema,
    mutationRegistry: clientArgs.mutationRegistry ?? sticky.mutationRegistry,
    queryRegistry: clientArgs.queryRegistry ?? sticky.queryRegistry,
    sessionQuery: clientArgs.sessionQuery ?? sticky.sessionQuery,
    schemaEpoch: clientArgs.schemaEpoch ?? sticky.schemaEpoch,
    
  };
}

function registerClientMeta(
  ctx: BootedSimKernel,
  clientArgs: AddClientArgs
): { readonly actorId: string; readonly deviceId: string } {
  const actorId = clientArgs.actorId ?? clientArgs.id;
  const deviceId = `device:${clientArgs.id}`;
  const prior = ctx.metas.get(clientArgs.id);
  const schema = pickCarry(clientArgs.localSchema, prior?.lastLocalSchema);
  const mutations = pickCarry(
    clientArgs.mutationRegistry,
    prior?.lastMutationRegistry
  );
  const queries = pickCarry(clientArgs.queryRegistry, prior?.lastQueryRegistry);
  const session = pickCarry(clientArgs.sessionQuery, prior?.lastSessionQuery);
  const epoch = pickCarry(clientArgs.schemaEpoch, prior?.lastSchemaEpoch);
  const meta: ClientMeta = {
    id: clientArgs.id,
    actorId,
    deviceId,
    ...(prior?.lastDbBundle !== undefined
      ? { lastDbBundle: prior.lastDbBundle }
      : {}),
    ...(schema !== undefined ? { lastLocalSchema: schema.value } : {}),
    ...(mutations !== undefined
      ? { lastMutationRegistry: mutations.value }
      : {}),
    ...(queries !== undefined ? { lastQueryRegistry: queries.value } : {}),
    ...(session !== undefined ? { lastSessionQuery: session.value } : {}),
    ...(epoch !== undefined ? { lastSchemaEpoch: epoch.value } : {}),
  };
  ctx.metas.set(clientArgs.id, meta);
  ctx.authByDevice.set(deviceId, meta);
  if (!ctx.authStatusByDevice.has(deviceId)) {
    ctx.authStatusByDevice.set(deviceId, 'valid');
  }
  return { actorId, deviceId };
}

function createPubSubFactory(
  ctx: BootedSimKernel,
  pubEndpoint: string
): {
  readonly createPubSub: () => PubSub;
  readonly pubsubRemakeCount: () => number;
  readonly subscribedTopics: () => readonly string[];
} {
  let pubsubInstance: PubSub | null = null;
  let remakeCount = 0;
  return {
    createPubSub: () => {
      remakeCount += 1;
      pubsubInstance?.close();
      pubsubInstance = ctx.broker.createPubSub(pubEndpoint);
      return pubsubInstance;
    },
    pubsubRemakeCount: () => remakeCount,
    subscribedTopics: () => ctx.broker.subscribedTopics(pubEndpoint),
  };
}

function simClientBuildArgs(
  ctx: BootedSimKernel,
  clientArgs: AddClientArgs,
  ids: { readonly actorId: string; readonly deviceId: string }
) {
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
  const pubsub = createPubSubFactory(ctx, pubEndpoint);
  return {
    id: clientArgs.id,
    actorId: ids.actorId,
    deviceId: ids.deviceId,
    now: () => ctx.nowFor(clientArgs.id),
    random: () => clientRng.random(),
    timers: ctx.timers,
    createId: ctx.nextId,
    http,
    server: ctx.server,
    auth: {
      actorId: ids.actorId,
      deviceId: ids.deviceId,
      accountId: `acct:${ids.actorId}`,
      isAnon: false,
    },
    ...pubsub,
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
    ...(ctx.domain.topicMap !== undefined
      ? { topicMap: ctx.domain.topicMap }
      : {}),
    ...(ctx.domain.defaultEntryChannel !== undefined
      ? { defaultEntryChannel: ctx.domain.defaultEntryChannel }
      : {}),
    faults: ctx.faults,
    ...(clientArgs.schemaEpoch !== undefined
      ? { schemaEpoch: clientArgs.schemaEpoch }
      : {}),
    ...(clientArgs.existingDb !== undefined
      ? { existingDb: clientArgs.existingDb }
      : {}),
    authControl: {
      getStatus: () => ctx.authStatusByDevice.get(ids.deviceId) ?? 'valid',
      refreshExpired: () => {
        if (ctx.authStatusByDevice.get(ids.deviceId) === 'expired') {
          ctx.authStatusByDevice.set(ids.deviceId, 'valid');
        }
      },
    },
    storagePressure: ctx.storagePressure,
  };
}

/** Add a client engine to the world and wait for first sync. */
export async function addClientImpl(
  ctx: BootedSimKernel,
  clientArgs: AddClientArgs
): Promise<SimClientHandle> {
  if (ctx.clients.has(clientArgs.id)) {
    throw new Error(`World: client ${clientArgs.id} already exists`);
  }
  const args = withSharedDbSticky(ctx, clientArgs);
  const ids = registerClientMeta(ctx, args);
  const handle = await buildSimClient(simClientBuildArgs(ctx, args, ids));
  const wrapped = wireMutateCrashArm(ctx, handle);
  ctx.clients.set(clientArgs.id, wrapped);
  await waitForSessionSync(ctx.scheduler, wrapped, clientArgs.id);
  return wrapped;
}
