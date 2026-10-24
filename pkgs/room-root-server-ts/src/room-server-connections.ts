import { Assert } from '@pkgs/assert-root-shared-ts/assert';
import { MAX_ROSTER_SIZE } from '@pkgs/room-root-shared-ts/bounds';
import {
  type RoomConnection,
  rejectedFrame,
} from '@pkgs/room-root-shared-ts/room-server-types';
import {
  ROOM_ERROR_TYPE,
  type RoomActor,
} from '@pkgs/room-root-shared-ts/types';

const crash: Assert = Assert.crash();

export function addRoomConnection(
  connections: Map<string, RoomConnection>,
  connection: RoomConnection
): void {
  const actor = connection.actor;
  crash.ok(!connections.has(connection.id), 'duplicate connection id', {
    id: connection.id,
  });
  crash.ok(actor.id.length > 0, 'RoomActor.id must be non-empty', { actor });
  crash.ok(actor.clientId.length > 0, 'RoomActor.clientId must be non-empty', {
    actor,
  });
  if (connections.size >= MAX_ROSTER_SIZE)
    throw new Error(
      `Tiger: roster full (MAX_ROSTER_SIZE=${String(MAX_ROSTER_SIZE)})`
    );
  connections.set(connection.id, connection);
}

export function hasAuthority(
  connections: ReadonlyMap<string, RoomConnection>
): boolean {
  return [...connections.values()].some(
    (connection) => connection.view.mode === 'authority'
  );
}

export function participates(
  connection: RoomConnection,
  authority: boolean
): boolean {
  const mode = connection.view.mode;
  return (
    mode === 'full' ||
    mode === 'authority' ||
    ((mode === 'dependent' || mode === 'dependent-read') && authority)
  );
}

export function readsHistory(
  connection: RoomConnection,
  authority: boolean
): boolean {
  return (
    connection.view.mode === 'dependent-read' ||
    participates(connection, authority)
  );
}

function connectionRefusal(
  connection: RoomConnection,
  authority: boolean
): string | null {
  const view = connection.view;
  return view.mode === 'presence' ||
    ((view.mode === 'dependent' || view.mode === 'dependent-read') &&
      !authority)
    ? view.reason
    : null;
}

export function refuseConnectionCommand(
  connection: RoomConnection,
  connections: ReadonlyMap<string, RoomConnection>,
  commandId: string
): boolean {
  const reason = connectionRefusal(connection, hasAuthority(connections));
  if (reason === null) return false;
  connection.send(
    rejectedFrame(commandId, { type: ROOM_ERROR_TYPE.unauthorized, reason })
  );
  return true;
}

export function participatingRoster(
  connections: ReadonlyMap<string, RoomConnection>
): readonly RoomActor[] {
  const authority = hasAuthority(connections);
  return [...connections.values()]
    .filter((connection) => participates(connection, authority))
    .map((connection) => connection.actor);
}
