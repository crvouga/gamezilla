import { TURN_GAMES } from '@libs/game-catalog-shared/turn-games';
import type { CustomGameInput } from '@libs/game-session-shared/custom-game-choice';
import { customGameLegalMoves } from '@libs/game-session-shared/custom-game-position';
import { customGameStartable } from '@libs/game-session-shared/custom-game-state';
import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared/flows';
import type { ChessBoardPromotionChoice } from '@pkgs/chess-board-core-shared/probe';
import { chessBoardPromotionTestId } from '@pkgs/chess-board-core-shared/probe';
import type { Square } from '@pkgs/chess-board-core-shared/types';
import type { CustomGameProbe } from './custom-game-ui';
import {
  chooseCustomGame,
  readCustomGameProbe,
  waitCustomGameSettled,
} from './custom-game-ui';

function choiceTarget(input: CustomGameInput, probe: CustomGameProbe): string {
  if ('side' in input) return `chess-custom-${input.side}-${input.operation}`;
  switch (input.operation) {
    case 'create':
      return probe.current === null
        ? 'chess-custom-create'
        : 'chess-custom-new';
    case 'rematch':
      return 'chess-custom-rematch';
    case 'unready':
      return 'chess-custom-ready';
    case 'move':
      return 'chess-custom-board';
    case 'claimWin':
      return 'chess-custom-claim-win';
    default:
      return `chess-custom-${input.operation}`;
  }
}

async function prepareChoice(
  s: ProductHarness,
  actor: string,
  input: CustomGameInput
): Promise<void> {
  const ui = await actorUi(s, actor);
  if (
    'side' in input &&
    ['take', 'bot', 'open', 'close', 'invite'].includes(input.operation)
  ) {
    const toggle = `chess-custom-${input.side}-choices`;
    if (
      !(await ui
        .get(`chess-custom-${input.side}-${input.operation}`)
        .isVisible()) &&
      (await ui.get(toggle).isVisible())
    )
      await ui.get(toggle).tap();
  }
  if (
    ['swap', 'clock', 'untimed'].includes(input.operation) &&
    !(await ui.get(`chess-custom-${input.operation}`).isVisible()) &&
    (await ui.get('chess-custom-options').isVisible())
  )
    await ui.get('chess-custom-options').tap();
  if (
    input.operation === 'clock' &&
    (await ui.get('chess-custom-minutes').isVisible())
  ) {
    await ui.get('chess-custom-minutes').clear();
    await ui.get('chess-custom-minutes').input(String(input.minutes));
    await ui.get('chess-custom-increment').clear();
    await ui.get('chess-custom-increment').input(String(input.increment));
  }
}

function boardAllows(probe: CustomGameProbe, input: CustomGameInput): boolean {
  return (
    input.operation === 'move' &&
    probe.current !== null &&
    probe.connected &&
    probe.live &&
    probe.current.status === 'active' &&
    probe.mySide === probe.current.turn &&
    customGameLegalMoves(probe.current, TURN_GAMES).some((move) =>
      move.startsWith(input.uci)
    )
  );
}

function confirmUnavailable(
  probe: CustomGameProbe,
  input: CustomGameInput
): boolean {
  if (input.operation !== 'cancel' && input.operation !== 'resign')
    return false;
  if (!probe.connected || probe.current === null) return true;
  if (input.operation === 'resign')
    return (
      probe.current.status !== 'active' ||
      probe.mySide === null ||
      !probe.gates['play']
    );
  return (
    !['configuring', 'active'].includes(probe.current.status) ||
    !probe.gates['cancel']
  );
}

async function enterMove(
  s: ProductHarness,
  actor: string,
  input: CustomGameInput
): Promise<void> {
  if (input.operation !== 'move') throw new Error('not a board move');
  const ui = await actorUi(s, actor);
  await ui.get('chess-custom-board').layout();
  const board = new ChessBoardFlows(ui, 'chess-custom-board');
  await board.tapSquare(input.uci.slice(0, 2) as Square);
  await board.tapSquare(input.uci.slice(2, 4) as Square);
  const piece = input.uci[4];
  if (piece !== undefined)
    await ui
      .get(
        chessBoardPromotionTestId(
          'chess-custom-board',
          piece as ChessBoardPromotionChoice
        )
      )
      .tap();
}

/** A pawn reaching the last rank without a chosen piece waits on the picker. */
async function promotionAsked(
  s: ProductHarness,
  actor: string,
  input: CustomGameInput
): Promise<boolean> {
  if (input.operation !== 'move' || input.uci.length !== 4) return false;
  const ui = await actorUi(s, actor);
  const board = new ChessBoardFlows(ui, 'chess-custom-board');
  return (await board.readProbe()).promotion !== null;
}

/** Normal controls for expressible choices; modified-client input for refusals. */
export async function changeThroughCustomGameControls(
  s: ProductHarness,
  actor: string,
  input: CustomGameInput
): Promise<void> {
  const probe = await readCustomGameProbe(s, actor);
  if (probe === null) throw new Error(`${actor} sees no Custom Game screen`);
  await prepareChoice(s, actor, input);
  const ui = await actorUi(s, actor);
  const target = choiceTarget(input, probe);
  const cannotStart =
    input.operation === 'start' &&
    (probe.current === null || !customGameStartable(probe.current));
  const modified =
    input.operation === 'invite' ||
    (input.operation === 'ready' &&
      probe.mySide !== null &&
      probe.current?.ready.includes(probe.mySide) === true) ||
    (input.operation === 'unready' &&
      (probe.mySide === null ||
        probe.current?.ready.includes(probe.mySide) !== true)) ||
    confirmUnavailable(probe, input) ||
    cannotStart ||
    (input.operation === 'move' && !boardAllows(probe, input));
  if (
    modified ||
    !(await ui.get(target).isVisible()) ||
    (await ui.snapshotHtml())
      ?.match(new RegExp(`<button[^>]*data-testid="${target}"[^>]*>`))?.[0]
      ?.includes('data-phase="success"') === true
  ) {
    await chooseCustomGame(s, actor, input);
    return;
  }
  if (input.operation === 'move') {
    await enterMove(s, actor, input);
    if (await promotionAsked(s, actor, input)) return;
  } else {
    await ui.get(target).tap();
    if (input.operation === 'cancel' || input.operation === 'resign')
      await ui.get(`${target}-confirm`).tap();
  }
  await waitCustomGameSettled(s, actor, probe.settled);
  if (
    (input.operation === 'cancel' || input.operation === 'resign') &&
    (await ui.get(`${target}-done`).isVisible())
  )
    await ui.get(`${target}-done`).tap();
}
