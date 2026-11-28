/**
 * Chess's own game-session board, as a person uses it: a move made square by
 * square (and with the promotion picker), and the board as it is painted —
 * how it faces and a promotion still waiting. Every other choice is the
 * shared game-session controls'.
 */

import { operateGameSessionControls } from '@libs/game-session-harness-ts/game-session-controls';
import {
  GAME_SESSION_BOARD,
  gameSessionBoardTakes,
  playOnGameSessionBoard,
} from '@libs/game-session-harness-ts/game-session-moves';
import type { GameSessionAction } from '@libs/game-session-harness-ts/game-session-screen';
import { chooseGameSession } from '@libs/game-session-harness-ts/game-session-ui';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared-ts/flows';
import type {
  ChessBoardProbe,
  ChessBoardPromotionChoice,
} from '@pkgs/chess-board-core-shared-ts/probe';
import { chessBoardPromotionTestId } from '@pkgs/chess-board-core-shared-ts/probe';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';

type MoveInput = Extract<GameSessionAction, { operation: 'move' }>;

async function enterMove(
  s: ProductHarness,
  actor: string,
  input: MoveInput
): Promise<void> {
  const ui = await actorUi(s, actor);
  await ui.get(GAME_SESSION_BOARD).layout();
  const board = new ChessBoardFlows(ui, GAME_SESSION_BOARD);
  await board.tapSquare(input.uci.slice(0, 2) as Square);
  await board.tapSquare(input.uci.slice(2, 4) as Square);
  const piece = input.uci[4];
  if (piece !== undefined)
    await ui
      .get(
        chessBoardPromotionTestId(
          GAME_SESSION_BOARD,
          piece as ChessBoardPromotionChoice
        )
      )
      .tap();
}

/** A pawn reaching the last rank without a chosen piece waits on the picker. */
async function promotionAsked(
  s: ProductHarness,
  actor: string,
  input: MoveInput
): Promise<boolean> {
  if (input.uci.length !== 4) return false;
  const ui = await actorUi(s, actor);
  const board = new ChessBoardFlows(ui, GAME_SESSION_BOARD);
  return (await board.readProbe()).promotion !== null;
}

/**
 * A chess move on the board, square by square (and the promotion picker),
 * when the board takes it; every other choice through the shared controls.
 */
async function changeThroughGameSessionControls(
  s: ProductHarness,
  actor: string,
  input: GameSessionAction
): Promise<void> {
  if (input.operation !== 'move') {
    await operateGameSessionControls(s, actor, input);
    return;
  }
  if (!(await gameSessionBoardTakes(s, actor, input.uci))) {
    await chooseGameSession(s, actor, input);
    return;
  }
  await playOnGameSessionBoard(s, actor, async () => {
    await enterMove(s, actor, input);
    return (await promotionAsked(s, actor, input)) ? 'waiting' : 'made';
  });
}

/** One game-session choice, a move made on chess's board as a person does. */
export const changeGameSession = scenarioAction({
  name: 'changeGameSession',
  act: changeThroughGameSessionControls,
});

/**
 * The Game Session board as painted while the game is played, or `null`
 * when it is not on screen (a lobby pictures no board).
 */

export async function readGameSessionBoardProbe(
  s: ProductHarness,
  actor: string
): Promise<ChessBoardProbe | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  if (await ui.get(GAME_SESSION_BOARD).isVisible())
    return new ChessBoardFlows(ui, GAME_SESSION_BOARD).readProbe();
  return null;
}
