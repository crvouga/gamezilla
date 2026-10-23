import { isViewingSpaceClient } from '@libs/spaces-shared-ts/space-presence-client-id';
import type { RoomActor } from '@pkgs/room-root-shared-ts/types';

export type PresencePerson = {
  readonly id: string;
  readonly clientId: string;
};

type PresenceInput = {
  readonly roster: readonly RoomActor[];
  readonly hostId: string | null;
  readonly seated: ReadonlySet<string>;
  readonly connected: boolean;
  readonly selfId: string | null;
  readonly selfClientId: string | null;
};

function representative(clients: readonly RoomActor[]): RoomActor | null {
  return (
    clients.find((client) => isViewingSpaceClient(client.clientId)) ??
    clients[0] ??
    null
  );
}

function grouped(roster: readonly RoomActor[]): Map<string, RoomActor[]> {
  const byId = new Map<string, RoomActor[]>();
  for (const actor of roster) {
    const clients = byId.get(actor.id);
    if (clients === undefined) byId.set(actor.id, [actor]);
    else clients.push(actor);
  }
  return byId;
}

function offlineSelf(input: PresenceInput): readonly PresencePerson[] {
  if (
    input.hostId === null ||
    input.selfId !== input.hostId ||
    input.selfClientId === null
  ) {
    return [];
  }
  return [{ id: input.hostId, clientId: input.selfClientId }];
}

/**
 * Who presence counts: the host if any of their devices is connected
 * (including one that closed the app), and each other person once, only
 * while one of their devices is in the space.
 */
export function presencePeople(
  input: PresenceInput
): readonly PresencePerson[] {
  if (!input.connected || input.hostId === null) return offlineSelf(input);
  if (![...input.roster].some((actor) => actor.id === input.hostId)) {
    return [];
  }
  const people: PresencePerson[] = [];
  for (const [id, clients] of grouped(input.roster)) {
    const chosen = representative(clients);
    if (chosen === null) continue;
    const viewing = clients.some((client) =>
      isViewingSpaceClient(client.clientId)
    );
    const host = id === input.hostId;
    if (!host && (!viewing || !input.seated.has(id))) continue;
    people.push({ id, clientId: chosen.clientId });
  }
  return people;
}
