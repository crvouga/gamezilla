import type { Io } from '@pkgs/io';

import { InMemoryClientStorage } from '../client/adapters/storage/memory';
import { Room } from '../client/core/room';
import { InMemoryRoomStorage } from '../server/adapters/memory';
import { RoomServer } from '../server/core/room-server';
import type {
  RoomCommandPayload,
  RoomError,
  RoomEvent,
  RoomModule,
  RoomState,
} from '../types';

import { LoopbackRoomTransport } from './loopback-transport';

export type LoopbackRoomSystem<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  server: RoomServer<S, C, E, string>;
  room: Room<S, C, E, string>;
  transport: LoopbackRoomTransport<S, C, E>;
};

export type OpenLoopbackRoomArgs<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  topic: string;
  module: RoomModule<S, C, E, string>;
  /** Injectable I/O bag (required — no wall default). */
  io: Io;
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
  const { io } = args;
  let server = args.server;
  if (server === undefined) {
    const storage = new InMemoryRoomStorage();
    server = new RoomServer<S, C, E, string>({
      topic: args.topic,
      module: args.module,
      storage,
      clock: io.clock,
    });
    await server.hydrateFromStorage();
  }

  const connectionId = args.connectionId ?? `loopback-${io.createId()}`;
  const identity = args.identity ?? 'test-user';
  const clientId = args.clientId ?? connectionId;

  const transport = new LoopbackRoomTransport(server, connectionId, identity);

  server.registerConnection(
    connectionId,
    (msg) => {
      transport.deliverToClient(msg);
    },
    { id: identity, clientId }
  );

  const clientStorage = new InMemoryClientStorage();
  const room = await Room.open<S, C, E, string>({
    topic: args.topic,
    module: args.module,
    storage: clientStorage,
    transport,
    identity,
    clock: io.clock,
    timers: io.timers,
    createId: io.createId,
    ...(args.onError !== undefined ? { onError: args.onError } : {}),
  });

  return { server, room, transport };
}
