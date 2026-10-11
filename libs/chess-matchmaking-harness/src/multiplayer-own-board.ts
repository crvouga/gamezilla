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
import type { MultiplayerCommand } from './multiplayer-commands';
import {
  forgetMultiplayerReply,
  sendMultiplayerCommand,
} from './multiplayer-commands';

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

/** The seat below the board, nearest the person holding the device. */
export type NearestMultiplayerSeat = {
  /** The multiplayer opponent's name and multiplayer rating, when it is theirs. */
  readonly opponent: string | null;
  /** Whose multiplayer clock the seat carries. */
  readonly clock: 'white' | 'black' | null;
};

export async function nearestMultiplayerSeat(
  s: ProductHarness,
  actor: string
): Promise<NearestMultiplayerSeat> {
  await bringToFront(s, actor);
  const seat = (await actorUi(s, actor)).get('multiplayer-seat-near');
  const opponent = seat.get('multiplayer-opponent');
  let clock: 'white' | 'black' | null = null;
  for (const side of ['white', 'black'] as const)
    if (await seat.get(`multiplayer-${side}-clock`).isVisible()) clock = side;
  return {
    opponent: (await opponent.isVisible()) ? await opponent.text() : null,
    clock,
  };
}

/**
 * The earlier position a person's screen shows, as the number of moves
 * played to reach it: 0 at the start of the game. Null while their board
 * shows the current position.
 */
export async function shownEarlierPosition(
  s: ProductHarness,
  actor: string
): Promise<number | null> {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  if (!(await ui.get('multiplayer-reviewing').isVisible())) return null;
  for (let ply = 1; ; ply++) {
    const move = ui.get(`multiplayer-move-${String(ply)}`);
    if (!(await move.isVisible())) return 0;
    if ((await move.attribute('aria-current')) === 'true') return ply;
  }
}

/** How many accepted moves the multiplayer move list on a screen shows. */
export async function shownMultiplayerMoveCount(
  s: ProductHarness,
  actor: string
): Promise<number> {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  for (let ply = 1; ; ply++)
    if (!(await ui.get(`multiplayer-move-${String(ply)}`).isVisible()))
      return ply - 1;
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
    const ui = await actorUi(s, actor);
    await ui.get(`multiplayer-move-${String(ply)}`).tap();
    await s.session.waitForIdle();
  },
});

/**
 * The person steps one move back or forward through the multiplayer move
 * list: with its control, or with the keyboard's left or right arrow.
 */
export const stepMultiplayerMoves = scenarioAction({
  name: 'stepMultiplayerMoves',
  act: async (
    s,
    actor: string,
    direction: 'back' | 'forward',
    keyboard = false
  ) => {
    await Promise.resolve(openMultiplayerChess.act(s, actor));
    const ui = await actorUi(s, actor);
    if (keyboard)
      await ui
        .get('multiplayer-moves')
        .key(direction === 'back' ? 'arrowLeft' : 'arrowRight');
    else await ui.get(`multiplayer-review-${direction}`).tap();
    await s.session.waitForIdle();
  },
});

function pressing(name: string, control: string) {
  return scenarioAction({
    name,
    act: async (s, actor: string) => {
      await Promise.resolve(openMultiplayerChess.act(s, actor));
      await (await actorUi(s, actor)).get(control).tap();
      await s.session.waitForIdle();
    },
  });
}

/** The person goes to the start of the multiplayer move list. */
export const goToMultiplayerStart = pressing(
  'goToMultiplayerStart',
  'multiplayer-review-start'
);
/** The person returns to the current position, in the one step offered. */
export const returnToCurrentPosition = pressing(
  'returnToCurrentPosition',
  'multiplayer-return-to-current'
);

/** The person's hand tries a piece on the board their screen shows. */
export const tryMultiplayerPiece = scenarioAction({
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
export const flipMultiplayerBoard = pressing(
  'flipMultiplayerBoard',
  'multiplayer-flip-board'
);
