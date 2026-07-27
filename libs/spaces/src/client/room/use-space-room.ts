import { useMyDeviceId, useMyId } from '@libs/auth/client/use-current-user';
import { useConfigService } from '@libs/auth/client/config-service-context';
import {
  useFreshAuthToken,
  useGetFreshAuthToken,
} from '@libs/auth/client/use-fresh-auth-token';
import { useKv } from '@pkgs/kv/kv-context';
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
import { useRoomResumeLiveness } from './use-room-resume-liveness';
import { useSpacePresence } from '../use-space-presence';

type SpaceRoom = Room<RoomState, RoomCommandPayload, RoomEvent, string>;

export type SpaceRoomUiState = {
  /** Open room client for registry-backed hooks; `null` while connecting. */
  room: SpaceRoom | null;
  isSynced: boolean;
  roomActive: boolean;
};

export function useSpaceRoom(spaceId: string): SpaceRoomUiState {
  const deviceId = useMyDeviceId();
  const memberId = useMyId();
  const presence = useSpacePresence(spaceId);
  const configService = useConfigService();
  const kv = useKv();
  const sessionToken = useFreshAuthToken();
  const getFreshToken = useGetFreshAuthToken();

  const bootstrap = useMemo((): SpaceRoomConnectionBootstrap | null => {
    if (
      spaceId.length === 0 ||
      deviceId.length === 0 ||
      memberId.length === 0
    ) {
      return null;
    }
    if (presence.status !== 'active') {
      return null;
    }
    return {
      spaceId,
      myId: memberId,
      installId: deviceId,
    };
  }, [spaceId, deviceId, memberId, presence.status]);

  const { room, transport } = useSpaceRoomConnection({
    bootstrap,
    configService,
    kv,
    sessionToken,
    getFreshToken,
  });
  useRoomResumeLiveness(transport);
  const snap = useRoomSnapshot(room);
  const isSynced = RoomMetaAttr.isSynced.from(snap);
  return {
    room,
    roomActive: room !== null,
    isSynced,
  };
}
