import { useMyId } from '@gamezilla/auth/client/use-current-user';
import { useConfigService } from '@gamezilla/auth/client/config-service-context';
import { useDeviceId } from '@gamezilla/auth/client/use-device-id';
import { useSessionToken } from '@gamezilla/auth/client/use-session-token';
import { useKv } from '@gamezilla/kv/kv-context';
import { useCurrentSpaceIds } from '../use-current-space-ids';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@gamezilla/spaces/shared/space-entities';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type {
  Room,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@gamezilla/room';
import { RoomMetaAttr, useRoomSnapshot } from '@gamezilla/room';
import { useMemo } from 'react';

import type { SpaceRoomConnectionBootstrap } from './space-room-connection-bootstrap';
import { useSpaceRoomConnection } from './use-space-room-connection';

type SpaceRoom = Room<RoomState, RoomCommandPayload, RoomEvent, string>;

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
    attribute: SpaceAttr.endedAt,
  });
  const isLive = endedAt === null;
  const { entries } = useCurrentSpaceIds();
  const myId = useMyId();
  const deviceId = useDeviceId();
  const configService = useConfigService();
  const kv = useKv();
  const sessionToken = useSessionToken();

  const inThisSpace = useMemo(
    () => entries.some((e) => e.spaceId === spaceId),
    [entries, spaceId]
  );

  const bootstrap = useMemo((): SpaceRoomConnectionBootstrap | null => {
    if (spaceId.length === 0 || !isLive || !inThisSpace || myId.length === 0) {
      return null;
    }
    return {
      spaceId,
      myId,
      installId: deviceId,
    };
  }, [spaceId, isLive, inThisSpace, myId, deviceId]);

  const { room } = useSpaceRoomConnection(
    bootstrap,
    configService,
    kv,
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
