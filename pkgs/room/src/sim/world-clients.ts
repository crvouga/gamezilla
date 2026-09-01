import type { Timers } from '@pkgs/clock';
import type { SimClock, SimScheduler } from '@pkgs/determinism';
import type { CreateId, SeededRng } from '@pkgs/uuid';

import { InMemoryClientStorage } from '../client/adapters/storage/memory';
import { RoomClient } from '../client/core/room-client';
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

import type { RoomBoundaryFaultController } from './boundary-faults';
import type { RoomSimClientHandle, RoomSimNodeHandle } from './handles';
import type { SimRoomNetwork } from './network';
import type { SerialQueue } from './serial-queue';
import {
  clientDomainHash,
  drainRoomSim,
  type RoomSimClientSlot,
} from './settle';
import { SimLoopbackRoomTransport } from './sim-loopback-transport';

export type WorldKernel<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  readonly seed: bigint;
  readonly topic: string;
  readonly module: RoomModule<S, C, E, string>;
  readonly clock: SimClock;
  readonly scheduler: SimScheduler;
  readonly timers: Timers;
  readonly createId: CreateId;
  readonly rng: SeededRng;
  readonly storage: InMemoryRoomStorage;
  /** Mutable — replaced on serverCrash/restart. */
  server: RoomServer<S, C, E, string>;
  readonly network: SimRoomNetwork;
  readonly serverQueue: SerialQueue;
  readonly slots: Map<string, RoomSimClientSlot<S, C, E>>;
  readonly handles: Map<string, RoomSimClientHandle<S, C, E>>;
  readonly boundary: RoomBoundaryFaultController;
  serverCrashed: boolean;
  scheduleDispose: () => void;
  /** Rebind schedule inject after server recreate. */
  bindScheduleInject: (server: RoomServer<S, C, E, string>) => void;
  /** Optional crash hook when a boundary arm trips. */
  onBoundaryCrash?: (clientKey: string) => void;
};

function asRoomError(v: unknown): RoomError | null {
  if (typeof v !== 'object' || v === null) return null;
  if (!('type' in v)) return null;
  return v as RoomError;
}

function drainKernel<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>): Promise<void> {
  return drainRoomSim({
    seed: k.seed,
    now: () => k.clock.now(),
    network: k.network,
    scheduler: k.scheduler,
    serverQueue: k.serverQueue,
    clients: k.slots,
  });
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

export async function attachClient<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  k: WorldKernel<S, C, E>,
  slot: RoomSimClientSlot<S, C, E>,
  opts?: { readonly wipeStorage?: boolean }
): Promise<void> {
  if (slot.room !== null) return;
  if (opts?.wipeStorage === true) {
    slot.clientStorage = new InMemoryClientStorage();
  }
  slot.crashed = false;
  const connectionId = `conn-${slot.key}-${k.createId()}`;
  slot.connectionId = connectionId;
  const transport = new SimLoopbackRoomTransport<S, C, E>({
    getServer: () => k.server,
    connectionId,
    identity: slot.identity,
    clientKey: slot.key,
    network: k.network,
    serverQueue: k.serverQueue,
    boundary: k.boundary,
    onBoundaryCrash: (key) => {
      k.onBoundaryCrash?.(key);
    },
  });
  k.network.registerClient(slot.key, (payload) => {
    transport.deliverToClientNow(payload);
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
    clock: k.clock,
    timers: k.timers,
    createId: k.createId,
    topic: k.topic,
  });
  const room = await RoomClient.open<S, C, E, string>({
    topic: k.topic,
    module: k.module,
    storage: slot.clientStorage,
    transport,
    identity: slot.identity,
    clock: k.clock,
    timers: k.timers,
    createId: k.createId,
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
  if (slot.crashed) {
    await restartClient(k, slot);
    return;
  }
  if (slot.room === null || slot.transport === null) {
    await attachClient(k, slot);
    return;
  }
  const connectionId = `conn-${slot.key}-${k.createId()}`;
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
  if (slot.crashed || slot.room === null || slot.transport === null) {
    await attachClient(k, slot);
    return;
  }
  const transport = slot.transport;
  if (slot.connectionId.length > 0) {
    k.server.unregisterConnection(slot.connectionId);
  }
  unregisterActorPeers(k, slot);
  const connectionId = `conn-${slot.key}-${k.createId()}`;
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
    transport.softDisconnect();
    transport.softReconnect();
  }
  await drainKernel(k);
}

/** Sync tear-down so boundary arms can crash before the next dispatch. */
export function crashClientSync<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, slot: RoomSimClientSlot<S, C, E>): void {
  if (slot.crashed && slot.room === null) return;
  const room = slot.room;
  const transport = slot.transport;
  const connectionId = slot.connectionId;
  slot.scheduleDispose?.();
  delete slot.scheduleDispose;
  slot.room = null;
  slot.transport = null;
  slot.connectionId = '';
  slot.crashed = true;
  room?.destroy();
  transport?.destroy();
  k.network.unregisterClient(slot.key);
  if (connectionId.length > 0) {
    k.server.unregisterConnection(connectionId);
  }
}

/** Hard crash: tear down Room + transport; keep {@link RoomSimClientSlot.clientStorage}. */
export async function crashClient<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, slot: RoomSimClientSlot<S, C, E>): Promise<void> {
  crashClientSync(k, slot);
  await drainKernel(k);
}

/** Restart after crash (or soft-missing room), optionally wiping local storage. */
export async function restartClient<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  k: WorldKernel<S, C, E>,
  slot: RoomSimClientSlot<S, C, E>,
  opts?: { readonly wipeStorage?: boolean }
): Promise<void> {
  if (slot.room !== null) {
    await crashClient(k, slot);
  }
  await attachClient(k, slot, opts);
}

export async function clearClientLocalData<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, slot: RoomSimClientSlot<S, C, E>): Promise<void> {
  const wasConnected = slot.room !== null && !slot.crashed;
  if (slot.room !== null) {
    await crashClient(k, slot);
  }
  slot.clientStorage = new InMemoryClientStorage();
  if (wasConnected || slot.crashed) {
    await attachClient(k, slot);
  }
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
  slot.crashed = true;
  room?.destroy();
  transport?.destroy();
  k.network.unregisterClient(slot.key);
  if (connectionId.length > 0) {
    k.server.unregisterConnection(connectionId);
  }
  await drainKernel(k);
}

/** Re-register live transports on a fresh server after hydrate. */
export function rebindLiveConnections<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>): void {
  for (const slot of k.slots.values()) {
    if (slot.transport === null || slot.room === null || slot.crashed) continue;
    if (slot.connectionId.length === 0) continue;
    const transport = slot.transport;
    k.server.registerConnection(
      slot.connectionId,
      (msg) => {
        transport.enqueueFromServer(msg);
      },
      { id: slot.identity, clientId: slot.clientId },
      { silent: true }
    );
  }
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
    isCrashed: () => slot.crashed,
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
    now: () => k.clock.now(),
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
    crash: async () => {
      const slot = k.slots.get(key);
      if (slot === undefined) {
        throw new Error(`node.crash: unknown client ${key}`);
      }
      await crashClient(k, slot);
    },
    restart: async (opts) => {
      const slot = k.slots.get(key);
      if (slot === undefined) {
        throw new Error(`node.restart: unknown client ${key}`);
      }
      await restartClient(k, slot, opts);
    },
    clearLocalData: async () => {
      const slot = k.slots.get(key);
      if (slot === undefined) {
        throw new Error(`node.clearLocalData: unknown client ${key}`);
      }
      await clearClientLocalData(k, slot);
    },
  };
}
