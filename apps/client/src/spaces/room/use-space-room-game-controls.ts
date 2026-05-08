import {
  GamesRoomAttr,
  SelectGame,
} from '@gamezilla/domain/spaces/space-module';
import type { SelectedSpaceGame } from '@gamezilla/domain/spaces/games/games';
import { useRoomSnapshot, type Room, type RoomSnapshot } from '@gamezilla/room';
import { useCallback, useMemo, type MutableRefObject } from 'react';

type AppRoom = Room<Record<string, unknown>, unknown, unknown, string>;

function readSelectedGame(
  snap: RoomSnapshot<Record<string, unknown>> | null
): SelectedSpaceGame {
  if (snap === null) return null;
  return GamesRoomAttr.selected.from(snap.state);
}

export function useSpaceRoomGameControls(
  room: AppRoom | null,
  roomRef: MutableRefObject<AppRoom | null>
): {
  selectedGame: SelectedSpaceGame;
  selectGame: (game: SelectedSpaceGame) => void;
} {
  const snap = useRoomSnapshot(room);
  const selectGame = useCallback(
    (game: SelectedSpaceGame) => {
      const r = roomRef.current;
      if (r === null) return;
      if (!r.getSnapshot().isSynced) return;
      r.dispatch(SelectGame({ game }));
    },
    [roomRef]
  );
  return useMemo(
    () => ({
      selectedGame: readSelectedGame(snap),
      selectGame,
    }),
    [snap, selectGame]
  );
}
