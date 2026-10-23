/**
 * A `RoomServer` on the example game room over counting storage, with one
 * recording connection per person (connection id and client id = their
 * name).
 */

import type { Message } from '@pkgs/message-shared-ts/message';
import { AddOne, gameRoomModule } from '@pkgs/room-root-harness-ts/game-room';
import { RoomServer } from '@pkgs/room-root-server-ts/room-server';
import type { RoomServerConfig } from '@pkgs/room-root-shared-ts/room-server-types';
import type { RoomModule, RoomState } from '@pkgs/room-root-shared-ts/types';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';
import { CountingRoomStorage } from './counting-room-storage';
import { testPorts } from './ports';

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

export type StartServerOpts = {
  readonly storage?: CountingRoomStorage;
  readonly module?: RoomModule<RoomState, Message, Message, string>;
  readonly authorize?: RoomServerConfig<
    RoomState,
    Message,
    Message,
    string
  >['authorize'];
};

export async function startServer(
  opts: StartServerOpts = {}
): Promise<ServerRig> {
  const storage = opts.storage ?? new CountingRoomStorage();
  const server = new RoomServer<RoomState, Message, Message, string>({
    topic: 'room:1',
    module: opts.module ?? gameRoomModule,
    storage,
    clock: testPorts().clock,
    ...(opts.authorize !== undefined ? { authorize: opts.authorize } : {}),
  });
  await server.hydrateFromStorage();
  return {
    server,
    storage,
    connections: new Map(),
    tipReadsAtStart: storage.lastSeqReads,
  };
}

/** Connect `person`, admitted with `grants` (none by default). */
export function connectPerson(
  rig: ServerRig,
  person: string,
  grants: readonly string[] = []
): Connection {
  const connection: Connection = { id: person, frames: [] };
  rig.server.registerConnection(
    person,
    (frame) => connection.frames.push(frame),
    { id: person, clientId: person },
    { grants }
  );
  rig.connections.set(person, connection);
  return connection;
}

export function connection(rig: ServerRig, person: string): Connection {
  const found = rig.connections.get(person);
  if (found === undefined) throw new Error(`${person} is not connected`);
  return found;
}

/** An add-one command frame with the given command id. */
export function addOneCommand(id: string): Record<string, unknown> {
  return {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.command,
    id,
    ts: 1,
    payload: AddOne({}),
  };
}

export function framesOfKind(
  frames: readonly unknown[],
  kind: string
): readonly unknown[] {
  return frames.filter((f) => (f as { kind: string }).kind === kind);
}
