import {
  useConfigService,
  useDeviceService,
  useKeyValueStorage,
} from '@gamezilla/client/runtime/runtime-hooks';
import { sessionTokenAtom } from '@gamezilla/client/runtime/atoms';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import type { WebSocketRoomTransport } from '@gamezilla/room/client/adapters/transport/websocket';

import { useMyId } from '@gamezilla/client/auth/auth-context';
import type { SpaceRoomConnectionBootstrap } from './space-room-connection-bootstrap';
import { useSpaceRoomConnection } from './use-space-room-connection';
import { useSpaceRoomCounterControls } from './use-space-room-counter-controls';
import { useCurrentSpaces, useSpace } from './use-spaces';

export type SpaceRoomUiState = {
  count: number;
  increment: () => void;
  decrement: () => void;
  isSynced: boolean;
  roomActive: boolean;
  transport: WebSocketRoomTransport | null;
};

export function useSpaceRoom(spaceId: string | undefined): SpaceRoomUiState {
  const space = useSpace(spaceId);
  const { entries } = useCurrentSpaces();
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
      typeof spaceId !== 'string' ||
      spaceId.length === 0 ||
      !space.live ||
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
  }, [spaceId, space.live, inThisSpace, myId, deviceService]);

  const { room, roomRef, transport } = useSpaceRoomConnection(
    bootstrap,
    configService,
    storage,
    sessionToken
  );
  const controls = useSpaceRoomCounterControls(room, roomRef);
  return {
    ...controls,
    roomActive: room !== null,
    transport,
  };
}
