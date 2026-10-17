import { chessGameClient } from '@libs/chess-root-client/chess-game-client';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness/harness-game';
import { CHESS_HARNESS_SLICE } from './chess-harness-slice';
import { CHESS_PLAYABLE } from './chess-playable';

/** Chess as every shared game suite exercises it, with its puzzles beside it. */
export const CHESS_HARNESS_GAME: HarnessGame = assertHarnessGame({
  ...CHESS_PLAYABLE,
  client: chessGameClient,
  slice: CHESS_HARNESS_SLICE,
});
