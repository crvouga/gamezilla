import { useMyId } from '@gamezilla/client/auth/auth-context';
import {
  useConfigService,
  useDeviceService,
  useKeyValueStorage,
} from '@gamezilla/client/runtime/runtime-hooks';
import { sessionTokenAtom } from '@gamezilla/client/runtime/atoms';
import { useCurrentSpaceIds } from '@gamezilla/client/spaces/use-current-space-ids';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { Room } from '@gamezilla/room';
import { RoomMetaAttr, useRoomSnapshot } from '@gamezilla/room';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import type { SpaceRoomConnectionBootstrap } from './space-room-connection-bootstrap';
import { useSpaceRoomConnection } from './use-space-room-connection';

type SpaceRoom = Room<Record<string, unknown>, unknown, unknown, string>;

export type SpaceRoomUiState = {
  /** Open room client for registry-backed hooks; `null` while connecting. */
  room: SpaceRoom | null;
  isSynced: boolean;
  roomActive: boolean;
};

export function useSpaceRoom(spaceId: string): SpaceRoomUiState {
  const endedAt = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attributeKey: SpaceAttr.endedAt.key,

    parse: SpaceAttr.endedAt.parse,
  });
  const isLive = endedAt === null;
  const { entries } = useCurrentSpaceIds();
  const myId = useMyId();
  const deviceService = useDeviceService();
  const configService = useConfigService();
  const storage = useKeyValueStorage();
  const sessionToken = useAtomValue(sessionTokenAtom);

  const inThisSpace = useMemo(
    () => entries.some((e) => e.spaceId === spaceId),
    [entries, spaceId]
  );

  const bootstrap = useMemo((): SpaceRoomConnectionBootstrap | null => {
    if (
      spaceId.length === 0 ||
      !isLive ||
      !inThisSpace ||
      myId.length === 0
    ) {
      return null;
    }
    return {
      spaceId,
      myId,
      installId: deviceService.getDeviceId(),
    };
  }, [spaceId, isLive, inThisSpace, myId, deviceService]);

  const { room } = useSpaceRoomConnection(
    bootstrap,
    configService,
    storage,
    sessionToken
  );
  const snap = useRoomSnapshot(room);
  const isSynced = RoomMetaAttr.isSynced.from(snap);
  return {
    room,
    roomActive: room !== null,
    isSynced,
  };
}
