/**
 * Chess's own custom-game board, as a person uses it: a move made square by
 * square (and with the promotion picker), and the board as it is painted —
 * how it faces and a promotion still waiting. Every other choice is the
 * shared custom-game controls'.
 */

import { operateCustomGameControls } from '@libs/game-session-harness/custom-game-controls';
import {
  CUSTOM_GAME_BOARD,
  customGameBoardTakes,
  playOnCustomGameBoard,
} from '@libs/game-session-harness/custom-game-moves';
import type { CustomGameAction } from '@libs/game-session-harness/custom-game-screen';
import { chooseCustomGame } from '@libs/game-session-harness/custom-game-ui';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared/flows';
import type {
  ChessBoardProbe,
  ChessBoardPromotionChoice,
} from '@pkgs/chess-board-core-shared/probe';
import { chessBoardPromotionTestId } from '@pkgs/chess-board-core-shared/probe';
import type { Square } from '@pkgs/chess-board-core-shared/types';

type MoveInput = Extract<CustomGameAction, { operation: 'move' }>;

async function enterMove(
  s: ProductHarness,
  actor: string,
  input: MoveInput
): Promise<void> {
  const ui = await actorUi(s, actor);
  await ui.get(CUSTOM_GAME_BOARD).layout();
  const board = new ChessBoardFlows(ui, CUSTOM_GAME_BOARD);
  await board.tapSquare(input.uci.slice(0, 2) as Square);
  await board.tapSquare(input.uci.slice(2, 4) as Square);
  const piece = input.uci[4];
  if (piece !== undefined)
    await ui
      .get(
        chessBoardPromotionTestId(
          CUSTOM_GAME_BOARD,
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
  const board = new ChessBoardFlows(ui, CUSTOM_GAME_BOARD);
  return (await board.readProbe()).promotion !== null;
}

/**
 * A chess move on the board, square by square (and the promotion picker),
 * when the board takes it; every other choice through the shared controls.
 */
async function changeThroughCustomGameControls(
  s: ProductHarness,
  actor: string,
  input: CustomGameAction
): Promise<void> {
  if (input.operation !== 'move') {
    await operateCustomGameControls(s, actor, input);
    return;
  }
  if (!(await customGameBoardTakes(s, actor, input.uci))) {
    await chooseCustomGame(s, actor, input);
    return;
  }
  await playOnCustomGameBoard(s, actor, async () => {
    await enterMove(s, actor, input);
    return (await promotionAsked(s, actor, input)) ? 'waiting' : 'made';
  });
}

/** One custom-game choice, a move made on chess's board as a person does. */
export const changeCustomGame = scenarioAction({
  name: 'changeCustomGame',
  act: changeThroughCustomGameControls,
});

/** The Custom Game board as painted, or `null` when none is on screen. */
export async function readCustomGameBoardProbe(
  s: ProductHarness,
  actor: string
): Promise<ChessBoardProbe | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  if (!(await ui.get(CUSTOM_GAME_BOARD).isVisible())) return null;
  return new ChessBoardFlows(ui, CUSTOM_GAME_BOARD).readProbe();
}
