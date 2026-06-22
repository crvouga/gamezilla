import { useMyId } from '@libs/auth/client/use-current-user';
import { useConfigService } from '@libs/auth/client/config-service-context';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import { useSessionToken } from '@libs/auth/client/use-session-token';
import { useKv } from '@pkgs/kv/kv-context';
import { useCurrentSpaceRole } from '../use-current-space-role';
import {
  isReplicationHost,
  useReplicationIdentityIds,
} from '../use-replication-identity-ids';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@libs/spaces/shared/space-entities';
import { useQueryAttribute } from '@pkgs/patch-db/react';
import type {
  Room,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room';
import { RoomMetaAttr, useRoomSnapshot } from '@pkgs/room';
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
  const myId = useMyId();
  const identityIds = useReplicationIdentityIds();
  const endedAt = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.endedAt,
  });
  const isLive = endedAt === null;
  const role = useCurrentSpaceRole(spaceId);
  const hostId = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.hostId,
  });
  const isHostByEntity =
    endedAt === null && isReplicationHost(hostId, identityIds);
  const inThisSpace = role !== null || isHostByEntity;
  const deviceId = useDeviceId();
  const configService = useConfigService();
  const kv = useKv();
  const sessionToken = useSessionToken();

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
