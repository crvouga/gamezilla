import { InMemoryClientStorage } from '../client/adapters/memory-storage';
import { Room } from '../client/room';
import { InMemoryRoomStorage } from '../server/adapters/memory-storage';
import { RoomServer } from '../server/room-server';
import type { RoomError, RoomModule, RoomState } from '../types';

import { LoopbackRoomTransport } from './loopback-transport';

export type LoopbackRoomSystem<S extends RoomState, C, E> = {
  server: RoomServer<S, C, E, string>;
  room: Room<S, C, E, string>;
  transport: LoopbackRoomTransport<S, C, E>;
};

/**
 * Single-topic room with in-memory server storage + loopback client transport.
 */
export async function openLoopbackRoom<S extends RoomState, C, E>(args: {
  topic: string;
  module: RoomModule<S, C, E, string>;
  identity?: string;
  onError?: (err: RoomError | Error) => void;
}): Promise<LoopbackRoomSystem<S, C, E>> {
  const storage = new InMemoryRoomStorage();
  const server = new RoomServer<S, C, E, string>({
    topic: args.topic,
    module: args.module,
    storage,
  });
  await server.hydrateFromStorage();

  const connectionId = 'loopback-1';
  const identity = args.identity ?? 'test-user';

  const transport = new LoopbackRoomTransport(server, connectionId, identity);

  server.registerConnection(connectionId, (msg) => {
    transport.deliverToClient(msg);
  });

  const clientStorage = new InMemoryClientStorage();
  const room = await Room.open<S, C, E, string>({
    topic: args.topic,
    module: args.module,
    storage: clientStorage,
    transport,
    identity,
    ...(args.onError !== undefined ? { onError: args.onError } : {}),
  });

  return { server, room, transport };
}
