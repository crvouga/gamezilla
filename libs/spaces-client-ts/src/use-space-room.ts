import { useConfigService } from '@libs/auth-client-ts/config-service-context';
import { useMyDeviceId, useMyId } from '@libs/auth-client-ts/use-current-user';
import {
  useFreshAuthToken,
  useGetFreshAuthToken,
} from '@libs/auth-client-ts/use-fresh-auth-token';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { spacePresenceClientId } from '@libs/spaces-shared-ts/space-presence-client-id';
import type { SpaceRoomConnectionBootstrap } from '@libs/spaces-shared-ts/space-room-connection-bootstrap';
import { useKv } from '@pkgs/kv-root-client-ts/solid';
import type { RoomClient } from '@pkgs/room-root-client-ts/room-client';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import { createRoomSnapshot } from '@pkgs/room-root-client-ts/room-signals';
import type { ClientTransport } from '@pkgs/room-root-shared-ts/transport';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { type Accessor, createMemo } from 'solid-js';
import { useSpaceOpenRooms } from './space-open-rooms-store';
import { useRoomQueryRefresh } from './use-room-query-refresh';
import { useRoomResumeLiveness } from './use-room-resume-liveness';
import { useSpaceCan } from './use-space-can';
import { useSpaceRoomConnection } from './use-space-room-connection';

type SpaceRoom = RoomClient<RoomState, RoomCommandPayload, RoomEvent, string>;

export type SpaceRoomUiState = {
  /**
   * Open room client for registry-backed hooks. `null` only before local
   * hydrate finishes (or if open failed hard). Not tied to WebSocket /
   * Connecting… — once set, optimistic dispatch works offline.
   */
  readonly room: SpaceRoom | null;
  readonly transport: ClientTransport | null;
  readonly isSynced: boolean;
  readonly roomActive: boolean;
  /** Stable per open-session client id for the live roster. */
  readonly clientId: string;
};

function resolveId(spaceId: string | Accessor<string>): string {
  return typeof spaceId === 'string' ? spaceId : spaceId();
}

export function useSpaceRoom(
  spaceId: string | Accessor<string>
): SpaceRoomUiState {
  const hostsSpace = useSpaceCan(
    () => resolveId(spaceId),
    PERMISSION.spacesSelectGame
  );
  const deviceId = useMyDeviceId();
  const memberId = useMyId();
  const configService = useConfigService();
  const kv = useKv();
  const sessionToken = useFreshAuthToken();
  const getFreshToken = useGetFreshAuthToken();
  const createId = useCreateId();
  const rooms = useSpaceOpenRooms();
  const clientId = createMemo(() => {
    const id = resolveId(spaceId);
    const device = deviceId();
    return id.length > 0 && device.length > 0
      ? spacePresenceClientId(
          rooms.clientId(id, device, createId),
          rooms.viewingIds().has(id)
        )
      : '';
  });

  // Lifetime is owned by SpaceOpenRoomSlot (open-session row). Do not gate on
  // presence/paintReady — those flap and were destroying the single WS.
  const bootstrap = createMemo((): SpaceRoomConnectionBootstrap | null => {
    const id = resolveId(spaceId);
    const device = deviceId();
    const member = memberId();
    const client = clientId();
    if (
      id.length === 0 ||
      device.length === 0 ||
      member.length === 0 ||
      client.length === 0
    ) {
      return null;
    }
    return {
      spaceId: id,
      myId: member,
      hostsSpace: hostsSpace(),
      installId: device,
      clientId: client,
    };
  });

  const { room, transport } = useSpaceRoomConnection({
    bootstrap,
    configService,
    kv,
    sessionToken,
    getFreshToken,
  });
  useRoomResumeLiveness(transport);
  useRoomQueryRefresh(transport);
  const snapshot = createRoomSnapshot(room);
  const isSynced = createMemo(() => RoomMetaAttr.isSynced.from(snapshot()));
  return {
    get room() {
      return room();
    },
    get transport() {
      return transport();
    },
    get roomActive() {
      return room() !== null;
    },
    get isSynced() {
      return isSynced();
    },
    get clientId() {
      return clientId();
    },
  };
}
