import { chessGameClient } from '@libs/chess-root-client/chess-game-client';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness/harness-game';
import { chessSoundUrls } from '@pkgs/sounds-shared/chess-sound-urls';
import { CHESS_HARNESS_SLICE } from './chess-harness-slice';
import { CHESS_PLAYABLE } from './chess-playable';
import { readChessRecord } from './chess-record-reading';

/** Chess as every shared game suite exercises it, with its puzzles beside it. */
export const CHESS_HARNESS_GAME: HarnessGame = assertHarnessGame({
  ...CHESS_PLAYABLE,
  client: chessGameClient,
  slice: CHESS_HARNESS_SLICE,
  readRecord: readChessRecord,
  // Each move the board plays has its sound (a capture, a check and
  // castling are moves too); the puzzle's own cues are the right move's,
  // the wrong move's, the checkmate that solves it and the rating's (a
  // rating gain plays the promotion's sound).
  puzzleSounds: {
    [chessSoundUrls.move]: 'move',
    [chessSoundUrls.capture]: 'move',
    [chessSoundUrls.check]: 'move',
    [chessSoundUrls.castle]: 'move',
    [chessSoundUrls.illegal]: 'wrong move',
    [chessSoundUrls.gameEnd]: 'end',
    [chessSoundUrls.puzzleCorrectMove]: 'correct move',
    [chessSoundUrls.puzzleCheckmate]: 'solved',
    [chessSoundUrls.promote]: 'rating',
    [chessSoundUrls.puzzleEloCompleteLoss]: 'rating',
  },
});
