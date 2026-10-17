import { CHESS_TURN_GAMES } from '@libs/chess-sub-shared/chess-game';
import { operateCustomGameControls } from '@libs/game-session-harness/custom-game-controls';
import type { CustomGameProbe } from '@libs/game-session-harness/custom-game-ui';
import {
  chooseCustomGame,
  readCustomGameProbe,
  waitCustomGameSettled,
} from '@libs/game-session-harness/custom-game-ui';
import type { CustomGameInput } from '@libs/game-session-shared/custom-game-choice';
import { customGameLegalMoves } from '@libs/game-session-shared/custom-game-position';
import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared/flows';
import type { ChessBoardPromotionChoice } from '@pkgs/chess-board-core-shared/probe';
import { chessBoardPromotionTestId } from '@pkgs/chess-board-core-shared/probe';
import type { Square } from '@pkgs/chess-board-core-shared/types';

type MoveInput = Extract<CustomGameInput, { operation: 'move' }>;

function boardAllows(probe: CustomGameProbe, input: MoveInput): boolean {
  return (
    probe.current !== null &&
    probe.connected &&
    probe.live &&
    probe.current.status === 'active' &&
    probe.mySide === probe.current.turn &&
    customGameLegalMoves(probe.current, CHESS_TURN_GAMES).some((move) =>
      move.startsWith(input.uci)
    )
  );
}

async function enterMove(
  s: ProductHarness,
  actor: string,
  input: MoveInput
): Promise<void> {
  const ui = await actorUi(s, actor);
  await ui.get('custom-game-board').layout();
  const board = new ChessBoardFlows(ui, 'custom-game-board');
  await board.tapSquare(input.uci.slice(0, 2) as Square);
  await board.tapSquare(input.uci.slice(2, 4) as Square);
  const piece = input.uci[4];
  if (piece !== undefined)
    await ui
      .get(
        chessBoardPromotionTestId(
          'custom-game-board',
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
  const board = new ChessBoardFlows(ui, 'custom-game-board');
  return (await board.readProbe()).promotion !== null;
}

/**
 * A chess move on the board, square by square (and the promotion picker),
 * when the board takes it; every other choice through the shared controls.
 */
export async function changeThroughCustomGameControls(
  s: ProductHarness,
  actor: string,
  input: CustomGameInput
): Promise<void> {
  if (input.operation !== 'move') {
    await operateCustomGameControls(s, actor, input);
    return;
  }
  const probe = await readCustomGameProbe(s, actor);
  if (probe === null) throw new Error(`${actor} sees no Custom Game screen`);
  if (
    !boardAllows(probe, input) ||
    !(await (await actorUi(s, actor)).get('custom-game-board').isVisible())
  ) {
    await chooseCustomGame(s, actor, input);
    return;
  }
  await enterMove(s, actor, input);
  if (await promotionAsked(s, actor, input)) return;
  await waitCustomGameSettled(s, actor, probe.settled);
}
