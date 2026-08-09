import { useConfigService } from '@libs/auth/client/config-service-context';
import { useMyDeviceId, useMyId } from '@libs/auth/client/use-current-user';
import {
  useFreshAuthToken,
  useGetFreshAuthToken,
} from '@libs/auth/client/use-fresh-auth-token';
import { useKv } from '@pkgs/kv/kv-context';
import type {
  ClientTransport,
  Room,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room';
import { RoomMetaAttr, useRoomSnapshot } from '@pkgs/room';
import { useCreateId } from '@pkgs/uuid';
import { useMemo } from 'react';
import { getOrCreateSpaceClientId } from './space-open-session-store';
import type { SpaceRoomConnectionBootstrap } from './space-room-connection-bootstrap';
import { useRoomResumeLiveness } from './use-room-resume-liveness';
import { useSpaceRoomConnection } from './use-space-room-connection';

type SpaceRoom = Room<RoomState, RoomCommandPayload, RoomEvent, string>;

export type SpaceRoomUiState = {
  /**
   * Open room client for registry-backed hooks. `null` only before local
   * hydrate finishes (or if open failed hard). Not tied to WebSocket /
   * Connecting… — once set, optimistic dispatch works offline.
   */
  room: SpaceRoom | null;
  transport: ClientTransport | null;
  isSynced: boolean;
  roomActive: boolean;
  /** Stable per open-session client id for the live roster. */
  clientId: string;
};

export function useSpaceRoom(spaceId: string): SpaceRoomUiState {
  const deviceId = useMyDeviceId();
  const memberId = useMyId();
  const configService = useConfigService();
  const kv = useKv();
  const sessionToken = useFreshAuthToken();
  const getFreshToken = useGetFreshAuthToken();
  const createId = useCreateId();
  const clientId =
    spaceId.length > 0 ? getOrCreateSpaceClientId(spaceId, createId) : '';

  // Lifetime is owned by SpaceOpenRoomSlot (open-session row). Do not gate on
  // presence/paintReady — those flap and were destroying the single WS.
  const bootstrap = useMemo((): SpaceRoomConnectionBootstrap | null => {
    if (
      spaceId.length === 0 ||
      deviceId.length === 0 ||
      memberId.length === 0 ||
      clientId.length === 0
    ) {
      return null;
    }
    return {
      spaceId,
      myId: memberId,
      installId: deviceId,
      clientId,
    };
  }, [spaceId, deviceId, memberId, clientId]);

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
    transport,
    roomActive: room !== null,
    isSynced,
    clientId,
  };
}
