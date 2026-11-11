import type {
  MultiplayerGame,
  MultiplayerSide,
} from '@libs/game-matchmaking-shared-ts/game-state';
import {
  multiplayerOwner,
  multiplayerSideOf,
  multiplayerSides,
} from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import type { Accessor } from 'solid-js';
import type { MultiplayerViewer } from './multiplayer-seat';
import { useShownName } from './use-shown-name';

/**
 * Who this device is in the matched game: its own side (White's for a
 * watcher), the opponent as they may be shown, and the winner's name once
 * there is one.
 */
export function useMultiplayerViewer(
  game: Accessor<MultiplayerGame>,
  myId: Accessor<string>
) {
  const ownSide = (): MultiplayerSide =>
    multiplayerSideOf(game(), myId()) ?? 'white';
  const participant = (): boolean => multiplayerSideOf(game(), myId()) !== null;
  // A watcher sees the board from White's side.
  const other = (): MultiplayerSide =>
    multiplayerSides(game()).find((side) => side !== ownSide()) ?? 'black';
  const opponentName = useShownName(() => multiplayerOwner(game(), other()));
  const winnerName = useShownName(() =>
    multiplayerSides(game()).includes(game().outcome as MultiplayerSide)
      ? multiplayerOwner(game(), game().outcome as MultiplayerSide)
      : ''
  );
  const viewer = (): MultiplayerViewer => ({
    myId: myId(),
    participant: participant(),
    opponentName: opponentName(),
    opponentRating: game()[`${other()}_rating`] ?? '',
  });
  return { ownSide, participant, viewer, winnerName };
}
