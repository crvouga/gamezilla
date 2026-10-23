import { useMyId } from '@libs/auth-client-ts/use-current-user';
import {
  idleMemberIds,
  nextIdleChangeAt,
  SpaceActivityAttr,
} from '@libs/spaces-shared-ts/space-activity';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared-ts/space-members-messages';
import { createTimedValue } from '@pkgs/clock-client-ts/solid';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import {
  createRoomRoster,
  createRoomSnapshot,
} from '@pkgs/room-root-client-ts/room-signals';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';
import { type PresencePerson, presencePeople } from './presence-people';
import { useSpaceOpenRoomEntry } from './space-open-rooms-store';
import { useOwnSpaceActivity } from './use-own-space-activity';

export type OpenSpacePresence = {
  readonly people: Accessor<readonly PresencePerson[]>;
  readonly idle: Accessor<ReadonlySet<string>>;
  readonly ownActivity: Accessor<string>;
  readonly ownIdle: Accessor<boolean>;
};

/** Presence and idle for one open space, from the room this device holds. */
export function useOpenSpacePresence(spaceId: string): OpenSpacePresence {
  const entry = useSpaceOpenRoomEntry(() => spaceId);
  const room = () => entry()?.room ?? null;
  const roster = createRoomRoster(room);
  const snapshot = createRoomSnapshot(room);
  const myId = useMyId();
  const engine = useSyncEngine();
  const host = createQuery(
    () => sql<{ readonly host_member_id: string | null }>`
      SELECT host_member_id FROM spaces
      WHERE id = ${spaceId} AND deleted_at IS NULL
      LIMIT 1
    `
  );
  const activity = createMemo(() =>
    SpaceActivityAttr.activity.from(snapshot())
  );
  const own = useOwnSpaceActivity(
    () => entry()?.clientId,
    activity,
    () => engine.status().online
  );
  const observedActivity = createMemo(() => {
    const id = entry()?.clientId;
    const at = own.at();
    return id === undefined || at === undefined
      ? activity()
      : { ...activity(), [id]: at };
  });
  const live = createMemo(
    () =>
      RoomMetaAttr.isConnected.from(snapshot()) &&
      RoomMetaAttr.isSynced.from(snapshot()) &&
      engine.status().online
  );
  const people = createMemo(() =>
    presencePeople({
      roster: roster(),
      hostId: host.rows()[0]?.host_member_id ?? null,
      seated: new Set(Object.keys(SpaceMembersRoomAttr.seats.from(snapshot()))),
      connected: live(),
      selfId: myId(),
      selfClientId: entry()?.clientId ?? null,
    })
  );
  const idle = createTimedValue(
    (nowMs) =>
      idleMemberIds({
        roster: roster(),
        activity: observedActivity(),
        connected: live(),
        nowMs,
      }),
    (_value, nowMs) =>
      nextIdleChangeAt({
        roster: roster(),
        activity: observedActivity(),
        connected: live(),
        nowMs,
      })
  );
  const ownActivity = () => (own.at() === undefined ? '' : String(own.at()));
  const ownIdle = () =>
    roster().some((actor) => actor.id === myId())
      ? idle().has(myId())
      : own.idle();
  return { people, idle, ownActivity, ownIdle };
}
