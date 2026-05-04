import {
  useConfigService,
  useSecureStorage,
} from '@gamezilla/client/runtime/runtime-hooks';
import { sessionTokenAtom } from '@gamezilla/client/runtime/atoms';
import { getDefaultStore } from 'jotai';
import { useCallback, useMemo } from 'react';

import type { WebSocketRoomTransport } from '@gamezilla/room';

import { computeSpaceRoomBootstrap } from './space-room-bootstrap';
import { useSpaceRoomConnection } from './use-space-room-connection';
import { useSpaceRoomCounterControls } from './use-space-room-counter-controls';
import { useCurrentMembership, useSpace } from './use-spaces';

export type SpaceRoomUiState = {
  count: number;
  increment: () => void;
  decrement: () => void;
  isSynced: boolean;
  roomActive: boolean;
  transport: WebSocketRoomTransport | null;
  sessionPeerId: string | null;
};

export function useSpaceRoom(spaceId: string | undefined): SpaceRoomUiState {
  const space = useSpace(spaceId);
  const current = useCurrentMembership();
  const configService = useConfigService();
  const storage = useSecureStorage();
  const role = current.activeSpaceId === spaceId ? current.role : null;
  const getSessionToken = useCallback(
    () => getDefaultStore().get(sessionTokenAtom),
    []
  );

  const bootstrap = useMemo(
    () =>
      computeSpaceRoomBootstrap({
        spaceId,
        spaceLive: space.live,
        role,
        phantomPeerId: space.phantomPeerId,
        phantomPublicKey: space.phantomPublicKey,
        hostRoomPeerId: space.hostRoomPeerId,
        hostRoomPublicKey: space.hostRoomPublicKey,
      }),
    [
      spaceId,
      space.live,
      space.phantomPeerId,
      space.phantomPublicKey,
      space.hostRoomPeerId,
      space.hostRoomPublicKey,
      role,
    ]
  );
  const { room, roomRef, transport, sessionPeerId } = useSpaceRoomConnection(
    bootstrap,
    configService,
    storage,
    getSessionToken
  );
  const controls = useSpaceRoomCounterControls(room, roomRef);
  return {
    ...controls,
    roomActive: room !== null,
    transport,
    sessionPeerId,
  };
}
