import type { SimIo } from '@pkgs/io';

import { InMemoryClientStorage } from '../client/adapters/storage/memory';
import { Room } from '../client/core/room';
import { RoomMetaAttr } from '../client/core/room-meta';
import { createTimerScheduleStack } from '../effects/timer-schedule-stack';
import type { InMemoryRoomStorage } from '../server/adapters/memory';
import type { RoomServer } from '../server/core/room-server';
import type {
  RoomCommandPayload,
  RoomError,
  RoomEvent,
  RoomModule,
  RoomState,
} from '../types';

import type { SimRoomNetwork } from './network';
import type { SerialQueue } from './serial-queue';
import {
  clientDomainHash,
  drainRoomSim,
  type RoomSimClientSlot,
} from './settle';
import { SimLoopbackRoomTransport } from './sim-loopback-transport';
import type { RoomSimClientHandle, RoomSimNodeHandle } from './world-api';

export type WorldKernel<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  readonly seed: bigint;
  readonly topic: string;
  readonly module: RoomModule<S, C, E, string>;
  readonly io: SimIo;
  readonly storage: InMemoryRoomStorage;
  readonly server: RoomServer<S, C, E, string>;
  readonly network: SimRoomNetwork;
  readonly serverQueue: SerialQueue;
  readonly slots: Map<string, RoomSimClientSlot<S, C, E>>;
  readonly handles: Map<string, RoomSimClientHandle<S, C, E>>;
  readonly scheduleDispose: () => void;
};

function asRoomError(v: unknown): RoomError | null {
  if (typeof v !== 'object' || v === null) return null;
  if (!('type' in v)) return null;
  return v as RoomError;
}

export async function attachClient<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, slot: RoomSimClientSlot<S, C, E>): Promise<void> {
  if (slot.room !== null) return;
  const connectionId = `conn-${slot.key}-${k.io.createId()}`;
  slot.connectionId = connectionId;
  const transport = new SimLoopbackRoomTransport<S, C, E>({
    server: k.server,
    connectionId,
    identity: slot.identity,
    clientKey: slot.key,
    network: k.network,
    serverQueue: k.serverQueue,
  });
  unregisterActorPeers(k, slot);
  k.server.registerConnection(
    connectionId,
    (msg) => {
      transport.enqueueFromServer(msg);
    },
    { id: slot.identity, clientId: slot.clientId }
  );
  const clientSchedule = createTimerScheduleStack({
    clock: k.io.clock,
    timers: k.io.timers,
    createId: k.io.createId,
    topic: k.topic,
  });
  const room = await Room.open<S, C, E, string>({
    topic: k.topic,
    module: k.module,
    storage: new InMemoryClientStorage(),
    transport,
    identity: slot.identity,
    clock: k.io.clock,
    timers: k.io.timers,
    createId: k.io.createId,
    effectHandlers: [clientSchedule.handler],
  });
  clientSchedule.bindInject((cmd) => {
    room.dispatch(cmd.payload as C);
  });
  slot.transport = transport;
  slot.room = room;
  slot.scheduleDispose = clientSchedule.dispose;
  await drainKernel(k);
}

function unregisterActorPeers<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, slot: RoomSimClientSlot<S, C, E>): void {
  for (const id of k.server.connectionIdsForActor(
    slot.identity,
    slot.clientId
  )) {
    k.server.unregisterConnection(id);
  }
}

export async function softDisconnectClient<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, slot: RoomSimClientSlot<S, C, E>): Promise<void> {
  const transport = slot.transport;
  if (transport === null || slot.room === null) return;
  const connectionId = slot.connectionId;
  transport.softDisconnect();
  if (connectionId.length > 0) {
    k.server.unregisterConnection(connectionId);
    slot.connectionId = '';
  }
  slot.room.getSnapshot();
  await drainKernel(k);
}

export async function softReconnectClient<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, slot: RoomSimClientSlot<S, C, E>): Promise<void> {
  if (slot.room === null || slot.transport === null) {
    await attachClient(k, slot);
    return;
  }
  const connectionId = `conn-${slot.key}-${k.io.createId()}`;
  slot.connectionId = connectionId;
  const transport = slot.transport;
  transport.setConnectionId(connectionId);
  unregisterActorPeers(k, slot);
  k.server.registerConnection(
    connectionId,
    (msg) => {
      transport.enqueueFromServer(msg);
    },
    { id: slot.identity, clientId: slot.clientId }
  );
  transport.softReconnect();
  await drainKernel(k);
}

/** Session take-over: new connectionId, same Room + (identity, clientId). */
export async function takeOverClient<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, slot: RoomSimClientSlot<S, C, E>): Promise<void> {
  if (slot.room === null || slot.transport === null) {
    await attachClient(k, slot);
    return;
  }
  const transport = slot.transport;
  if (slot.connectionId.length > 0) {
    k.server.unregisterConnection(slot.connectionId);
  }
  unregisterActorPeers(k, slot);
  const connectionId = `conn-${slot.key}-${k.io.createId()}`;
  slot.connectionId = connectionId;
  transport.setConnectionId(connectionId);
  k.server.registerConnection(
    connectionId,
    (msg) => {
      transport.enqueueFromServer(msg);
    },
    { id: slot.identity, clientId: slot.clientId }
  );
  if (!transport.isConnected) {
    transport.softReconnect();
  } else {
    // Already open: force a fresh welcome via soft cycle.
    transport.softDisconnect();
    transport.softReconnect();
  }
  await drainKernel(k);
}

export async function destroyClient<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, slot: RoomSimClientSlot<S, C, E>): Promise<void> {
  const room = slot.room;
  const transport = slot.transport;
  const connectionId = slot.connectionId;
  slot.scheduleDispose?.();
  delete slot.scheduleDispose;
  slot.room = null;
  slot.transport = null;
  room?.destroy();
  transport?.destroy();
  if (connectionId.length > 0) {
    k.server.unregisterConnection(connectionId);
  }
  await drainKernel(k);
}

async function drainKernel<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>): Promise<void> {
  await drainRoomSim({
    seed: k.seed,
    now: () => k.io.clock.now(),
    network: k.network,
    serverQueue: k.serverQueue,
    clockAdvance: (ms) => k.io.clock.advance(ms),
    clients: k.slots,
  });
}

export function buildClientHandle<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  k: WorldKernel<S, C, E>,
  slot: RoomSimClientSlot<S, C, E>
): RoomSimClientHandle<S, C, E> {
  return {
    id: slot.key,
    identity: slot.identity,
    clientId: slot.clientId,
    dispatch: (payload) => {
      if (slot.room === null) {
        throw new Error(`dispatch: client ${slot.key} is disconnected`);
      }
      slot.room.dispatch(payload);
    },
    snapshot: () => {
      if (slot.room === null) {
        throw new Error(`snapshot: client ${slot.key} is disconnected`);
      }
      return slot.room.getSnapshot();
    },
    hash: () => {
      if (slot.room === null) {
        throw new Error(`hash: client ${slot.key} is disconnected`);
      }
      return clientDomainHash(k.module, slot.room);
    },
    isSynced: () => {
      if (slot.room === null) return false;
      return RoomMetaAttr.isSynced.from(slot.room.getSnapshot());
    },
    isConnected: () => {
      if (slot.room === null || slot.transport === null) return false;
      return RoomMetaAttr.isConnected.from(slot.room.getSnapshot());
    },
    room: () => slot.room,
    disconnect: async () => {
      await softDisconnectClient(k, slot);
    },
    connect: async () => {
      await softReconnectClient(k, slot);
    },
    lastRejection: () => {
      if (slot.room === null) return null;
      return asRoomError(RoomMetaAttr.lastError.from(slot.room.getSnapshot()));
    },
    injectToServer: (raw, opts) => {
      if (slot.transport === null) {
        throw new Error(`injectToServer: client ${slot.key} has no transport`);
      }
      slot.transport.injectToServer(raw, opts);
    },
    injectFromServer: (raw) => {
      if (slot.transport === null) {
        throw new Error(
          `injectFromServer: client ${slot.key} has no transport`
        );
      }
      slot.transport.injectFromServer(raw);
    },
  };
}

export function buildNodeHandle<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, key: string): RoomSimNodeHandle {
  return {
    now: () => k.io.clock.now(),
    disconnect: async () => {
      const slot = k.slots.get(key);
      if (slot === undefined) {
        throw new Error(`node.disconnect: unknown client ${key}`);
      }
      await softDisconnectClient(k, slot);
    },
    reconnect: async () => {
      const slot = k.slots.get(key);
      if (slot === undefined) {
        throw new Error(`node.reconnect: unknown client ${key}`);
      }
      await softReconnectClient(k, slot);
    },
    takeOver: async () => {
      const slot = k.slots.get(key);
      if (slot === undefined) {
        throw new Error(`node.takeOver: unknown client ${key}`);
      }
      await takeOverClient(k, slot);
    },
  };
}
