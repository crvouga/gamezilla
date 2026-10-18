import { CHESS_GAME_ID } from '@libs/chess-puzzle-shared/chess-game';
import type { ChessPuzzleTheme } from '@libs/chess-puzzle-shared/chess-puzzle-themes';
import {
  closePuzzleFeedSettings,
  openPuzzleFeedSettings,
  setPuzzleFeedTheme,
} from '@libs/game-session-harness/puzzle-feed';
import {
  readPuzzleBoardPosition,
  readPuzzleOnBoard,
  readPuzzleProbe,
} from '@libs/game-session-harness/puzzle-screen';
import { pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import type { Square } from '@pkgs/chess-board-core-shared/types';
import {
  dragPuzzleUci,
  pickPuzzlePromotion,
  pickUpPuzzlePieceAt,
  readPuzzleBoardProbe,
  tapPuzzleUci,
} from './chess-puzzle-solve-ui';
import {
  suggestPuzzleMove as dragSuggestedMove,
  expectPlayReady,
  pickWrongUci,
  playWrongMove,
  solvePuzzle,
} from './chess-puzzle-ui';
import { listenToTheApp, playPuzzleMoveWithKeyboard } from './puzzle-keyboard';

export const playUntilSolved = scenarioAction({
  name: 'playUntilSolved',
  act: solvePuzzle,
});

/** Drag a legal move that is not the solution; the attempt turns `wrong`. */
export const playWrongPuzzleMove = scenarioAction({
  name: 'playWrongPuzzleMove',
  act: playWrongMove,
});

/** Drag one UCI move on the puzzle board (solver input, §3). */
export const playPuzzleMove = scenarioAction({
  name: 'playPuzzleMove',
  act: (s, actorId: string, uci: string) => dragPuzzleUci(s, actorId, uci),
});

/** Tap-tap the same move (the no-drag input path, §3). */
export const tapPuzzleMove = scenarioAction({
  name: 'tapPuzzleMove',
  act: (s, actorId: string, uci: string) => tapPuzzleUci(s, actorId, uci),
});

/** Pick up the piece on a square to see where it can go (§3). */
export const pickUpPuzzlePiece = scenarioAction({
  name: 'pickUpPuzzlePiece',
  act: (s, actorId: string, square: Square) =>
    pickUpPuzzlePieceAt(s, actorId, square),
});

/** Choose a piece in the promotion picker (never auto-queen, §3). */
export const choosePuzzlePromotion = scenarioAction({
  name: 'choosePuzzlePromotion',
  act: (s, actorId: string, piece: 'q' | 'r' | 'b' | 'n') =>
    pickPuzzlePromotion(s, actorId, piece),
});

/** A spectator drags a legal move; the room records it as a suggestion. */
export const suggestPuzzleMove = scenarioAction({
  name: 'suggestPuzzleMove',
  act: dragSuggestedMove,
});

const SETTLE_MS = 20_000;
const POLL_MS = 250;

/** Wait until the solver may move: the attempt is live and the board unlocked. */
async function waitSolverCanMove(s: ProductHarness, actorId: string) {
  await pollUntil(
    s,
    async () =>
      (await readPuzzleBoardProbe(s, actorId))?.interactive === true
        ? true
        : null,
    { maxMs: SETTLE_MS, stepMs: POLL_MS, description: 'solver may move' }
  );
}

/** The next move of the line, once the solver may play it. */
async function nextSolutionUci(s: ProductHarness, actorId: string) {
  await waitSolverCanMove(s, actorId);
  const uci = (await readPuzzleProbe(s, actorId))?.next ?? '';
  if (uci.length < 4) throw new Error(`${actorId} has no next solution move`);
  return uci;
}

/**
 * Narrow the feed to `theme` (a theme only `puzzleId` carries) and wait
 * until that puzzle is on the board and the solver may move.
 */
export const openPuzzleByTheme = scenarioAction({
  name: 'openPuzzleByTheme',
  act: async (
    s,
    actorId: string,
    theme: ChessPuzzleTheme,
    puzzleId: string
  ) => {
    await Promise.resolve(openPuzzleFeedSettings.act(s, actorId));
    await Promise.resolve(
      setPuzzleFeedTheme.act(s, actorId, CHESS_GAME_ID, theme)
    );
    await Promise.resolve(closePuzzleFeedSettings.act(s, actorId));
    await expectPlayReady(s, actorId);
    await pollUntil(
      s,
      async () =>
        (await readPuzzleOnBoard(s, actorId)) === puzzleId ? true : null,
      { maxMs: SETTLE_MS, stepMs: POLL_MS, description: `puzzle ${puzzleId}` }
    );
    await waitSolverCanMove(s, actorId);
  },
});

/**
 * Castle the way the line expects, entered either as the king's two-square
 * step or as the king dropped onto its own rook.
 */
export const castlePuzzleKing = scenarioAction({
  name: 'castlePuzzleKing',
  act: async (s, actorId: string, entry: 'twoSquares' | 'ontoRook') => {
    const expected = await nextSolutionUci(s, actorId);
    const rookFile = expected[2] === 'g' ? 'h' : 'a';
    const to =
      entry === 'twoSquares'
        ? expected.slice(2, 4)
        : `${rookFile}${expected[3] ?? ''}`;
    await dragPuzzleUci(s, actorId, `${expected.slice(0, 2)}${to}`);
  },
});

/** The host plays the next move of the line and the board moves on. */
export const playNextSolutionMove = scenarioAction({
  name: 'playNextSolutionMove',
  act: async (s, actorId: string) => {
    const uci = await nextSolutionUci(s, actorId);
    const before = await readPuzzleBoardPosition(s, actorId);
    await dragPuzzleUci(s, actorId, uci);
    await pollUntil(
      s,
      async () => {
        const fen = await readPuzzleBoardPosition(s, actorId);
        return fen !== null && fen !== before ? true : null;
      },
      { maxMs: SETTLE_MS, stepMs: POLL_MS, description: 'the board to move' }
    );
  },
});

/** A watcher suggests a legal move that is not the host's next move. */
export const suggestNonSolutionMove = scenarioAction({
  name: 'suggestNonSolutionMove',
  act: async (s, actorId: string) => {
    const solution = (await readPuzzleProbe(s, actorId))?.next ?? '';
    const fen = await readPuzzleBoardPosition(s, actorId);
    if (fen === null) throw new Error(`${actorId} sees no board`);
    const uci = pickWrongUci(fen, solution);
    await dragSuggestedMove(
      s,
      actorId,
      uci.slice(0, 2) as Square,
      uci.slice(2, 4) as Square
    );
  },
});

/** Registered on every system that composes this sub. */
export const CHESS_HARNESS_ACTIONS = [
  listenToTheApp,
  playPuzzleMoveWithKeyboard,
  playUntilSolved,
  playPuzzleMove,
  tapPuzzleMove,
  pickUpPuzzlePiece,
  choosePuzzlePromotion,
  playWrongPuzzleMove,
  suggestPuzzleMove,
  openPuzzleByTheme,
  castlePuzzleKing,
  playNextSolutionMove,
  suggestNonSolutionMove,
];
