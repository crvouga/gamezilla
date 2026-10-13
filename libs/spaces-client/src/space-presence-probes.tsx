import { useMyId } from '@libs/auth-client/use-current-user';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared/space-members-messages';
import { isViewingSpaceClient } from '@libs/spaces-shared/space-presence-client-id';
import {
  memberIsIdle,
  SpaceQuietRoomAttr,
} from '@libs/spaces-shared/space-quiet';
import { Handles } from '@libs/test-ids-shared/handles';
import { RoomMetaAttr } from '@pkgs/room-root-client/room-meta';
import type { RoomActor, RoomState } from '@pkgs/room-root-shared/types';
import sql from '@pkgs/sql-root-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import {
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
} from 'solid-js';

import { useSpaceOpenRoomEntries } from './space-open-rooms-store';

type HostRow = { readonly id: string; readonly host_member_id: string | null };

function listed(ids: ReadonlySet<string>): string {
  return [...ids].sort().join('\n');
}

function clientPresent(id: string): boolean {
  return isViewingSpaceClient(id) || id.startsWith('away:');
}

/** Guests count only while some device of the host is still in the space. */
function hostPresent(
  hostId: string | null,
  grouped: ReadonlyMap<string, readonly string[]>
): boolean {
  if (hostId === null) return false;
  return (grouped.get(hostId) ?? []).some(clientPresent);
}

function peopleIn(
  roster: readonly RoomActor[],
  seats: Readonly<Record<string, unknown>>,
  hostId: string | null
): Map<string, string[]> {
  const byPerson = new Map<string, string[]>();
  for (const actor of roster) {
    if (actor.id !== hostId && !Object.hasOwn(seats, actor.id)) continue;
    const clients = byPerson.get(actor.id) ?? [];
    clients.push(actor.clientId);
    byPerson.set(actor.id, clients);
  }
  return byPerson;
}

function collectSpacePeople(args: {
  readonly state: RoomState;
  readonly roster: readonly RoomActor[];
  readonly hostId: string | null;
  readonly viewerId: string | null;
  readonly people: Set<string>;
  readonly idle: Set<string>;
}): void {
  if (!RoomMetaAttr.isConnected.from(args.state)) {
    if (args.hostId !== null && args.hostId === args.viewerId)
      args.people.add(args.hostId);
    return;
  }
  const grouped = peopleIn(
    args.roster,
    SpaceMembersRoomAttr.seats.from(args.state),
    args.hostId
  );
  if (!hostPresent(args.hostId, grouped)) return;
  const quiet = SpaceQuietRoomAttr.quiet.from(args.state);
  for (const [person, clients] of grouped) {
    if (!clients.some(clientPresent)) continue;
    args.people.add(person);
    if (memberIsIdle(quiet, clients)) args.idle.add(person);
  }
}

/** People and idle marks for every space this device still has open. */
export function SpacePresenceProbes(): JSX.Element {
  const myId = useMyId();
  const entries = useSpaceOpenRoomEntries();
  const hosts = createQuery(
    () =>
      sql<HostRow>`
      SELECT id, host_member_id FROM spaces
      WHERE ended_at IS NULL AND deleted_at IS NULL
    `
  );
  const [revision, setRevision] = createSignal(0);

  createEffect(() => {
    const stops: (() => void)[] = [];
    for (const entry of entries().values()) {
      stops.push(entry.room.subscribe(() => setRevision((n) => n + 1)));
    }
    onCleanup(() => {
      for (const stop of stops) stop();
    });
  });

  const reading = createMemo(() => {
    revision();
    const hostOf = new Map(
      hosts.rows().map((row) => [row.id, row.host_member_id])
    );
    const people = new Set<string>();
    const idle = new Set<string>();
    for (const [spaceId, entry] of entries()) {
      collectSpacePeople({
        state: entry.room.getSnapshot(),
        roster: entry.room.getRoster(),
        hostId: hostOf.get(spaceId) ?? null,
        viewerId: myId(),
        people,
        idle,
      });
    }
    return { people: listed(people), idle: listed(idle) };
  });

  return (
    <>
      <span
        data-testid={Handles.spacePresencePeople}
        class="hidden"
        aria-hidden="true"
      >
        {reading().people}
      </span>
      <span
        data-testid={Handles.spacePresenceIdle}
        class="hidden"
        aria-hidden="true"
      >
        {reading().idle}
      </span>
    </>
  );
}
