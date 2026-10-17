import { chessGameClient } from '@libs/chess-root-client/chess-game-client';
import { chessGameShared } from '@libs/chess-sub-shared/chess-game';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness/harness-game';
import { CHESS_HARNESS_SLICE } from './chess-harness-slice';

/** Chess as every shared game suite exercises it, with its puzzles beside it. */
export const CHESS_HARNESS_GAME: HarnessGame = assertHarnessGame({
  label: 'chess',
  shared: chessGameShared,
  client: chessGameClient,
  slice: CHESS_HARNESS_SLICE,
  // Scholar's mate: White mates on f7 with the seventh move.
  firstSideVictory: ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'],
});
