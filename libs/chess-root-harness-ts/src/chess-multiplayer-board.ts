/**
 * Chess's own board in a matched game, as a person's screen shows it: the
 * side it faces and where the pieces stand, flipping it, a move chosen in
 * the move list by how chess writes it, a piece tried on a board that shows
 * an earlier position, and a move made with the keyboard square by square.
 * Finding an opponent itself is the shared driver's.
 */

import type { MatchedGameMove } from '@libs/game-matchmaking-harness-ts/multiplayer-board';
import { sendMoveFromBoard } from '@libs/game-matchmaking-harness-ts/multiplayer-board';
import { reviewMultiplayerMoves } from '@libs/game-matchmaking-harness-ts/multiplayer-review';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import {
  actorUi,
  ensureActor,
  scenarioAction,
} from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared-ts/flows';
import {
  chessBoardProbeTestId,
  chessBoardSquareTestId,
  parseChessBoardProbe,
} from '@pkgs/chess-board-core-shared-ts/probe';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import { CHESS_GAME_ID } from './chess-playable';

const BOARD = Handles.multiplayerBoard;

/** `actor` opens chess's finding an opponent, as the shared driver does. */
function openChessMatches(s: ProductHarness, actor: string) {
  return Promise.resolve(openFindingAnOpponent.act(s, actor, CHESS_GAME_ID));
}

/** A person's own multiplayer board, as their screen shows it. */
export type ShownMultiplayerBoard = {
  /** The multiplayer game on the screen; null when there is none. */
  readonly gameId: string | null;
  /** The side the board is seen from. */
  readonly facing: 'white' | 'black' | null;
  /** Where the pieces stand on the board, in Forsyth-Edwards Notation. */
  readonly pieces: string | null;
  /** A piece can be moved on the board as it is shown. */
  readonly canMovePiece: boolean;
  /** The screen says the board shows an earlier position. */
  readonly earlierPosition: boolean;
  /** What the screen tells the person about that earlier position. */
  readonly told: string | null;
};

const NO_BOARD: ShownMultiplayerBoard = {
  gameId: null,
  facing: null,
  pieces: null,
  canMovePiece: false,
  earlierPosition: false,
  told: null,
};

/** The board on a person's multiplayer screen: its side, pieces and game. */
export async function shownMultiplayerBoard(
  s: ProductHarness,
  actor: string
): Promise<ShownMultiplayerBoard> {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  if (
    !(await ui.get('multiplayer-game').isVisible()) ||
    !(await ui.get(BOARD).isVisible())
  )
    return NO_BOARD;
  // The board's own account of what it paints, for a reader without eyes.
  const probe = ui.get(chessBoardProbeTestId(BOARD));
  const board = parseChessBoardProbe(await probe.text());
  const reviewing = ui.get('multiplayer-reviewing');
  const earlierPosition = await reviewing.isVisible();
  return {
    earlierPosition,
    told: earlierPosition ? await reviewing.text() : null,
    gameId: await ui.get('multiplayer-game').attribute('data-game-id'),
    facing: board.orientation,
    pieces: board.fen.split(' ')[0] ?? null,
    canMovePiece: board.interactive,
  };
}

/** The move of the multiplayer move list that is written this way. */
async function movePly(
  s: ProductHarness,
  actor: string,
  san: string
): Promise<number> {
  const ui = await actorUi(s, actor);
  for (let ply = 1; ; ply++) {
    const move = ui.get(`multiplayer-move-${String(ply)}`);
    if (!(await move.isVisible()))
      throw new Error(`${actor}'s multiplayer move list has no move ${san}`);
    if ((await move.text()) === san) return ply;
  }
}

/**
 * The person chooses a move in the multiplayer move list: by how it is
 * written (`e4`), or by how many moves led to the position after it.
 */
export const chooseMultiplayerMove = scenarioAction({
  name: 'chooseMultiplayerMove',
  act: async (s, actor: string, move: string | number) => {
    await openChessMatches(s, actor);
    const ply = typeof move === 'number' ? move : await movePly(s, actor, move);
    await Promise.resolve(reviewMultiplayerMoves.act(s, actor, ply));
  },
});

/** The person's hand tries a piece on the board their screen shows. */
const tryMultiplayerPiece = scenarioAction({
  name: 'tryMultiplayerPiece',
  act: async (s, actor: string, uci: string) => {
    await ensureActor(s, actor);
    await new ChessBoardFlows(await actorUi(s, actor), BOARD).drag(
      uci.slice(0, 2) as Square,
      uci.slice(2, 4) as Square
    );
    await s.session.waitForIdle();
  },
});

/**
 * The person plays a move on their device. A board that shows an earlier
 * position is all they have in front of them, so their hand tries the piece
 * on it; any other board sends the move as its screen does.
 */
export const playMultiplayerMove = scenarioAction({
  name: 'playMultiplayerMove',
  act: async (s, actor: string, move: MatchedGameMove) => {
    if ((await sendMoveFromBoard(s, actor, move)) === 'reviewing')
      await Promise.resolve(tryMultiplayerPiece.act(s, actor, move.uci));
  },
});

/** The person flips their own multiplayer board, or flips it back. */
export const flipMultiplayerBoard = scenarioAction({
  name: 'flipMultiplayerBoard',
  act: async (s, actor: string) => {
    await openChessMatches(s, actor);
    await (await actorUi(s, actor)).get('multiplayer-flip-board').tap();
    await s.session.waitForIdle();
  },
});

/** The person moves a piece with the keyboard alone: Enter on each square. */
export const moveMultiplayerPieceWithKeyboard = scenarioAction({
  name: 'moveMultiplayerPieceWithKeyboard',
  act: async (s, actor: string, uci: string) => {
    await openChessMatches(s, actor);
    const ui = await actorUi(s, actor);
    for (const square of [uci.slice(0, 2), uci.slice(2, 4)])
      await ui
        .get(chessBoardSquareTestId(BOARD, square as Square))
        .key('enter');
    await s.session.waitForIdle();
  },
});

/** Chess's own matched-game actions, beside the shared ones. */
export const CHESS_MULTIPLAYER_BOARD_ACTIONS = [
  chooseMultiplayerMove,
  playMultiplayerMove,
  flipMultiplayerBoard,
  moveMultiplayerPieceWithKeyboard,
];
