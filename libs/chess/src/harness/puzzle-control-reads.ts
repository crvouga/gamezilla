import { actorUi } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { bringToFront, visible } from '@libs/harness/system/observations';
import { Handles } from '@libs/test-ids';
import { readPuzzleDebug } from './chess-puzzle-ui';
import { readPuzzleAssistant } from './puzzle-assistant-ui';

export async function readPuzzleControlAvailability(
  s: ProductHarness,
  actor: string
) {
  return {
    retryOffered: await visible(s, actor, [Handles.chessPuzzleActionRetry]),
    moveOnOffered: await visible(s, actor, [Handles.chessPuzzleActionNext]),
    summaryMoveOnOffered: await visible(s, actor, [
      Handles.chessPuzzleSummaryNext,
    ]),
    resultSummaryVisible: await visible(s, actor, [Handles.chessPuzzleSummary]),
    editingFeed: await visible(s, actor, [Handles.chessPuzzleFeedDone]),
  };
}

export async function readPuzzleView(s: ProductHarness, actor: string) {
  await bringToFront(s, actor);
  if (await visible(s, actor, [Handles.chessPuzzlePlayScreen])) return 'Board';
  if (await visible(s, actor, [Handles.chessMenuPuzzle])) return 'ChessChoices';
  if (await visible(s, actor, [Handles.gameMenuChess])) return 'GameChoice';
  return 'Elsewhere';
}

export async function readPuzzleGuidance(s: ProductHarness, actor: string) {
  const onBoard = (await readPuzzleView(s, actor)) === 'Board';
  const debug = onBoard ? await readPuzzleDebug(s, actor) : null;
  const assistant = onBoard ? await readPuzzleAssistant(s, actor) : null;
  const wrongKinds = ['wrong', 'missed mate', 'hanging piece', 'knight fork'];
  const kind = assistant?.kind ?? 'none';
  return {
    position: debug?.solveIdx ?? 0,
    help: debug?.hintStage ?? 'none',
    guidance: wrongKinds.includes(kind) ? 'wrong' : kind,
  };
}

export async function readPuzzleRemainingToday(
  s: ProductHarness,
  actor: string
): Promise<number | null> {
  const ui = await actorUi(s, actor);
  if (!(await ui.get('chess-puzzle-remaining-today').isVisible())) return null;
  const text = await ui.get('chess-puzzle-remaining-today').text();
  const match = text?.match(/^\s*(\d+)/);
  return match === null || match === undefined ? null : Number(match[1]);
}
