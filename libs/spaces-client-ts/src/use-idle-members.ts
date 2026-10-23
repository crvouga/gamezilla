import {
  idleMemberIds,
  nextIdleChangeAt,
  SpaceActivityAttr,
} from '@libs/spaces-shared-ts/space-activity';
import { createTimedValue } from '@pkgs/clock-client-ts/solid';
import { useNamedRoomRoster } from '@pkgs/room-root-client-ts/room-clients-context';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { Accessor } from 'solid-js';
import {
  SPACE_ROOM_NAME,
  useSpaceRoomSelector,
} from './use-space-room-selector';

/** People whose every device in the space has been quiet for two minutes. */
export function useIdleMemberIds(): Accessor<ReadonlySet<string>> {
  const roster = useNamedRoomRoster(SPACE_ROOM_NAME);
  const activity = useSpaceRoomSelector(SpaceActivityAttr.activity.from);
  const connected = useSpaceRoomSelector(RoomMetaAttr.isConnected.from);
  const engine = useSyncEngine();
  return createTimedValue(
    (nowMs) =>
      idleMemberIds({
        roster: roster(),
        activity: activity(),
        connected: connected() && engine.status().online,
        nowMs,
      }),
    (_idle, nowMs) =>
      nextIdleChangeAt({
        roster: roster(),
        activity: activity(),
        connected: connected() && engine.status().online,
        nowMs,
      })
  );
}
