import { useMyId } from '@libs/auth-client/use-current-user';
import {
  idleMemberIds,
  nextIdleChangeAt,
  SpaceActivityAttr,
} from '@libs/spaces-shared/space-activity';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared/space-members-messages';
import { createTimedValue } from '@pkgs/clock-client/solid';
import { RoomMetaAttr } from '@pkgs/room-root-client/room-meta';
import {
  createRoomRoster,
  createRoomSnapshot,
} from '@pkgs/room-root-client/room-signals';
import sql from '@pkgs/sql-root-shared/sql';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client/sync-engine-context';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';
import { type PresencePerson, presencePeople } from './presence-people';
import { useSpaceOpenRoomEntry } from './space-open-rooms-store';

export type OpenSpacePresence = {
  readonly people: Accessor<readonly PresencePerson[]>;
  readonly idle: Accessor<ReadonlySet<string>>;
  readonly ownActivity: Accessor<string>;
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
        activity: activity(),
        connected: live(),
        nowMs,
      }),
    (_value, nowMs) =>
      nextIdleChangeAt({
        roster: roster(),
        activity: activity(),
        connected: live(),
        nowMs,
      })
  );
  const ownActivity = createMemo(() => {
    const clientId = entry()?.clientId;
    if (clientId === undefined) return '';
    const at = activity()[clientId];
    return at === undefined ? '' : String(at);
  });
  return { people, idle, ownActivity };
}
