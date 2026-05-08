import { useMyId } from '@gamezilla/client/auth/auth-context';
import {
  useConfigService,
  useDeviceService,
  useKeyValueStorage,
} from '@gamezilla/client/runtime/runtime-hooks';
import { sessionTokenAtom } from '@gamezilla/client/runtime/atoms';
import { parseAbsent } from '@gamezilla/client/spaces/lib/space-parsers';
import { useCurrentSpaceIds } from '@gamezilla/client/spaces/use-current-space-ids';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@gamezilla/domain/spaces/space-entities';
import type { SelectedSpaceGame } from '@gamezilla/domain/spaces/games/games';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { WebSocketRoomTransport } from '@gamezilla/room/client/adapters/transport/websocket';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import type { SpaceRoomConnectionBootstrap } from './space-room-connection-bootstrap';
import { useSpaceRoomConnection } from './use-space-room-connection';
import { useSpaceRoomCounterControls } from './use-space-room-counter-controls';
import { useSpaceRoomGameControls } from './use-space-room-game-controls';

export type SpaceRoomUiState = {
  count: number;
  increment: () => void;
  decrement: () => void;
  isSynced: boolean;
  roomActive: boolean;
  transport: WebSocketRoomTransport | null;
  selectedGame: SelectedSpaceGame;
  selectGame: (game: SelectedSpaceGame) => void;
};

export function useSpaceRoom(spaceId: string): SpaceRoomUiState {
  const isLive = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attributeKey: SpaceAttr.endedAt,
    attributeValue: parseAbsent,
  });
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

  const { room, roomRef, transport } = useSpaceRoomConnection(
    bootstrap,
    configService,
    storage,
    sessionToken
  );
  const counter = useSpaceRoomCounterControls(room, roomRef);
  const games = useSpaceRoomGameControls(room, roomRef);
  return {
    ...counter,
    ...games,
    roomActive: room !== null,
    transport,
  };
}
