import {
  useConfigService,
  useKeyValueStorage,
} from '@gamezilla/client/runtime/runtime-hooks';
import { sessionTokenAtom } from '@gamezilla/client/runtime/atoms';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import type { WebSocketRoomTransport } from '@gamezilla/room/client/adapters/transport/websocket';

import type { SpaceRoomConnectionBootstrap } from './space-room-connection-bootstrap';
import { useSpaceRoomConnection } from './use-space-room-connection';
import { useSpaceRoomCounterControls } from './use-space-room-counter-controls';
import { useCurrentMembership, useSpace } from './use-spaces';
import { useSelfAuthIdentity } from './device-display-resolution';

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
  const current = useCurrentMembership();
  const { selfAccountId } = useSelfAuthIdentity();
  const configService = useConfigService();
  const storage = useKeyValueStorage();
  const role = current.activeSpaceId === spaceId ? current.role : null;
  const sessionToken = useAtomValue(sessionTokenAtom);

  const bootstrap = useMemo((): SpaceRoomConnectionBootstrap | null => {
    if (
      typeof spaceId !== 'string' ||
      spaceId.length === 0 ||
      !space.live ||
      role === null ||
      selfAccountId === null
    ) {
      return null;
    }
    return { spaceId, accountId: selfAccountId };
  }, [spaceId, space.live, role, selfAccountId]);

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
