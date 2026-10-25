import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import { InMemoryClientStorage } from '@pkgs/room-adapter-memory-shared-ts/client-storage';
import { LoopbackRoomTransport } from '@pkgs/room-adapter-memory-shared-ts/loopback-transport';
import { InMemoryRoomStorage } from '@pkgs/room-adapter-memory-shared-ts/room-storage';
import { RoomClient } from '@pkgs/room-root-client-ts/room-client';
import { RoomServer } from '@pkgs/room-root-server-ts/room-server';
import { createTimerScheduleStack } from '@pkgs/room-root-shared-ts/timer-schedule-stack';
import type {
  RoomCommandPayload,
  RoomError,
  RoomEvent,
  RoomModule,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
export type LoopbackRoomSystem<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  server: RoomServer<S, C, E, string>;
  room: RoomClient<S, C, E, string>;
  transport: LoopbackRoomTransport;
};

export type OpenLoopbackRoomArgs<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  topic: string;
  module: RoomModule<S, C, E, string>;
  clock: Clock;
  timers: Timers;
  createId: CreateId;
  identity?: string;
  clientId?: string;
  connectionId?: string;
  /**
   * Reuse an existing server (multi-client tests). When omitted a fresh
   * in-memory server is created and hydrated.
   */
  server?: RoomServer<S, C, E, string>;
  onError?: (err: RoomError | Error) => void;
};

/**
 * Single-topic room with in-memory server storage + loopback client transport.
 * Pass an existing `server` to attach additional clients to the same room.
 */
export async function openLoopbackRoom<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: OpenLoopbackRoomArgs<S, C, E>): Promise<LoopbackRoomSystem<S, C, E>> {
  const { clock, timers, createId } = args;
  let server = args.server;
  if (server === undefined) {
    const storage = new InMemoryRoomStorage();
    const schedule = createTimerScheduleStack({
      clock,
      timers,
      createId,
      topic: args.topic,
    });
    server = new RoomServer<S, C, E, string>({
      topic: args.topic,
      module: args.module,
      storage,
      clock,
      timers,
      effectHandlers: [schedule.handler],
    });
    schedule.bindInject((cmd) =>
      server!.injectCommand({
        id: cmd.id,
        payload: cmd.payload as C,
        identity: cmd.identity,
      })
    );
    await server.hydrateFromStorage();
  }

  const connectionId = args.connectionId ?? `loopback-${createId()}`;
  const identity = args.identity ?? 'test-user';
  const clientId = args.clientId ?? connectionId;

  const transport = new LoopbackRoomTransport({
    server,
    connectionId,
    identity,
    clientId,
  });

  const clientSchedule = createTimerScheduleStack({
    clock,
    timers,
    createId,
    topic: args.topic,
  });
  const clientStorage = new InMemoryClientStorage();
  const room = await RoomClient.open<S, C, E, string>({
    topic: args.topic,
    module: args.module,
    storage: clientStorage,
    transport,
    identity,
    clock,
    timers,
    createId,
    effectHandlers: [clientSchedule.handler],
    ...(args.onError !== undefined ? { onError: args.onError } : {}),
  });
  clientSchedule.bindInject((cmd) => {
    room.dispatch(cmd.payload as C);
  });

  return { server, room, transport };
}
