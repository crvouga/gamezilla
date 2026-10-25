import { isMessageEnvelope } from '@pkgs/message-shared-ts/message';
import type { RoomConnection } from '@pkgs/room-root-shared-ts/room-server-types';
import { rejectedFrame } from '@pkgs/room-root-shared-ts/room-server-types';
import type { RoomSignalHandler } from '@pkgs/room-root-shared-ts/signals';
import type {
  RoomCommand,
  RoomCommandPayload,
  RoomError,
} from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';
import {
  hasAuthority,
  readsHistory,
  refuseConnectionCommand,
} from './room-server-connections';
import { broadcastToConnections } from './room-server-fanout';
import { sessionDenial, sessionGrantValid } from './session-grant';

/** Reuses room admission and authorization; never touches command verdict storage. */
export async function receiveRoomSignal<Identity>(args: {
  readonly connections: Map<string, RoomConnection>;
  readonly connection: RoomConnection;
  readonly command: RoomCommand;
  readonly identity: Identity;
  readonly now: () => number;
  readonly authorize: (
    command: RoomCommand,
    grants: readonly string[]
  ) => Promise<RoomError | null>;
  readonly handler: RoomSignalHandler<Identity> | undefined;
}): Promise<void> {
  const connection = args.connection;
  if (args.connections.get(connection.id) !== connection) return;
  if (refuseConnectionCommand(connection, args.connections, args.command.id))
    return;
  const denied = await args.authorize(args.command, connection.grants);
  // Authorization can yield while the transport is being replaced or removed.
  if (args.connections.get(connection.id) !== connection) return;
  if (refuseConnectionCommand(connection, args.connections, args.command.id))
    return;
  const refusal = sessionDenial(denied, connection.grants, args.now());
  const error =
    refusal ??
    (args.handler === undefined
      ? {
          type: ROOM_ERROR_TYPE.invalidCommand,
          reason: 'this room does not accept signals',
        }
      : await args.handler(args.command, args.identity, connection.actor));
  if (error !== null) connection.send(rejectedFrame(args.command.id, error));
}

/** One serialization/fanout per snapshot, optionally restricted to an explicit audience. */
export function publishRoomSignal(args: {
  readonly connections: Map<string, RoomConnection>;
  readonly payload: RoomCommandPayload;
  readonly now: number;
  readonly audience: readonly string[] | undefined;
}): void {
  if (!isMessageEnvelope(args.payload))
    throw new Error('room signal must be a Message envelope');
  const authority = hasAuthority(args.connections);
  broadcastToConnections(
    args.connections,
    {
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.signal,
      payload: args.payload,
    },
    (connection) =>
      readsHistory(connection, authority) &&
      sessionGrantValid(connection.grants, args.now) &&
      (args.audience === undefined ||
        args.audience.includes(connection.actor.id))
  );
}
