/**
 * A `RoomServer` on the cursor module over counting storage, with one
 * recording connection per person (connection id and client id = their
 * name).
 */

import type { Message } from '@pkgs/message';
import { ROOM_WIRE_KIND, type RoomState, WIRE_VERSION } from '@pkgs/room';
import { RoomServer } from '@pkgs/room/server';
import { CountingRoomStorage } from '../helpers/counting-room-storage';
import { CursorModule, Move } from '../helpers/cursor-module';
import { testPorts } from '../helpers/ports';

export type Connection = {
  readonly id: string;
  readonly frames: unknown[];
};

export type ServerRig = {
  readonly server: RoomServer<RoomState, Message, Message, string>;
  readonly storage: CountingRoomStorage;
  readonly connections: Map<string, Connection>;
  /** Log-tip reads storage had served once the server finished starting. */
  readonly tipReadsAtStart: number;
};

export async function startServer(
  storage = new CountingRoomStorage()
): Promise<ServerRig> {
  const server = new RoomServer<RoomState, Message, Message, string>({
    topic: 'room:1',
    module: CursorModule,
    storage,
    clock: testPorts().clock,
  });
  await server.hydrateFromStorage();
  return {
    server,
    storage,
    connections: new Map(),
    tipReadsAtStart: storage.lastSeqReads,
  };
}

export function connectPerson(rig: ServerRig, person: string): Connection {
  const connection: Connection = { id: person, frames: [] };
  rig.server.registerConnection(
    person,
    (frame) => connection.frames.push(frame),
    { id: person, clientId: person }
  );
  rig.connections.set(person, connection);
  return connection;
}

export function connection(rig: ServerRig, person: string): Connection {
  const found = rig.connections.get(person);
  if (found === undefined) throw new Error(`${person} is not connected`);
  return found;
}

/** A move command frame; the same id always carries the same move. */
export function moveCommand(id: string): Record<string, unknown> {
  return {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.command,
    id,
    ts: 1,
    payload: Move({ x: id.length, y: 0 }),
  };
}

export function framesOfKind(
  frames: readonly unknown[],
  kind: string
): readonly unknown[] {
  return frames.filter((f) => (f as { kind: string }).kind === kind);
}
