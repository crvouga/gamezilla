import type { MultiplayerCommand } from '@libs/game-matchmaking-harness/multiplayer-commands';
import {
  forgetMultiplayerReply,
  sendMultiplayerCommand,
} from '@libs/game-matchmaking-harness/multiplayer-commands';
import { reviewMultiplayerMoves } from '@libs/game-matchmaking-harness/multiplayer-review';
import { actorUi, ensureActor, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared/flows';
import {
  chessBoardProbeTestId,
  parseChessBoardProbe,
} from '@pkgs/chess-board-core-shared/probe';
import type { Square } from '@pkgs/chess-board-core-shared/types';
import { openMultiplayerChess } from './multiplayer-actions';

const BOARD = 'multiplayer-board';

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
    await Promise.resolve(openMultiplayerChess.act(s, actor));
    const ply = typeof move === 'number' ? move : await movePly(s, actor, move);
    await Promise.resolve(reviewMultiplayerMoves.act(s, actor, ply));
  },
});

function pressing(name: string, step: 'current') {
  return scenarioAction({
    name,
    act: async (s, actor: string) => {
      await Promise.resolve(openMultiplayerChess.act(s, actor));
      await Promise.resolve(reviewMultiplayerMoves.act(s, actor, step));
    },
  });
}

/** The person returns to the current position, in the one step offered. */
export const returnToCurrentPosition = pressing(
  'returnToCurrentPosition',
  'current'
);

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
  act: async (s, actor: string, command: MultiplayerCommand) => {
    await ensureActor(s, actor);
    const ui = await actorUi(s, actor);
    if (!(await ui.get('multiplayer-reviewing').isVisible())) {
      await Promise.resolve(sendMultiplayerCommand.act(s, actor, command));
      return;
    }
    forgetMultiplayerReply(s, actor);
    await Promise.resolve(
      tryMultiplayerPiece.act(s, actor, String(command.args['uci']))
    );
  },
});

/** The person flips their own multiplayer board, or flips it back. */
export const flipMultiplayerBoard = scenarioAction({
  name: 'flipMultiplayerBoard',
  act: async (s, actor: string) => {
    await Promise.resolve(openMultiplayerChess.act(s, actor));
    await (await actorUi(s, actor)).get('multiplayer-flip-board').tap();
    await s.session.waitForIdle();
  },
});
