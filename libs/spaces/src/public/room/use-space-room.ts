import { useConfigService } from '@libs/auth/public/config-service-context';
import { useMyDeviceId, useMyId } from '@libs/auth/public/use-current-user';
import {
  useFreshAuthToken,
  useGetFreshAuthToken,
} from '@libs/auth/public/use-fresh-auth-token';
import { useKv } from '@pkgs/kv/solid';
import type {
  ClientTransport,
  RoomClient,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room';
import { RoomMetaAttr } from '@pkgs/room';
import { createRoomSnapshot } from '@pkgs/room/solid';
import { useCreateId } from '@pkgs/uuid/solid';
import { type Accessor, createMemo } from 'solid-js';
import { SpaceOpenSessionStore } from './space-open-session-store';
import type { SpaceRoomConnectionBootstrap } from './space-room-connection-bootstrap';
import { useRoomResumeLiveness } from './use-room-resume-liveness';
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
  const deviceId = useMyDeviceId();
  const memberId = useMyId();
  const configService = useConfigService();
  const kv = useKv();
  const sessionToken = useFreshAuthToken();
  const getFreshToken = useGetFreshAuthToken();
  const createId = useCreateId();
  const clientId = createMemo(() => {
    const id = resolveId(spaceId);
    const device = deviceId();
    return id.length > 0 && device.length > 0
      ? new SpaceOpenSessionStore(createId).getOrCreate(id, device)
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
