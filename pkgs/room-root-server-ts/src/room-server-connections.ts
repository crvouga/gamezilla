import {
  type RoomConnection,
  rejectedFrame,
} from '@pkgs/room-root-shared-ts/room-server-types';
import {
  ROOM_ERROR_TYPE,
  type RoomActor,
} from '@pkgs/room-root-shared-ts/types';

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

/** Only participating identities change presence; previews and extra tabs do not. */
export function changedPresence(
  previous: string,
  roster: readonly RoomActor[]
): { readonly key: string; readonly present: readonly string[] } | null {
  const present = [...new Set(roster.map((actor) => actor.id))].sort();
  const key = JSON.stringify(present);
  return key === previous ? null : { key, present };
}

export function connectionIdsForActor(
  connections: ReadonlyMap<string, RoomConnection>,
  actorId: string,
  clientId: string
): readonly string[] {
  const out: string[] = [];
  for (const conn of connections.values())
    if (conn.actor.id === actorId && conn.actor.clientId === clientId)
      out.push(conn.id);
  return out;
}
