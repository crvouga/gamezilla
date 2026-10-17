import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront, visible } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';
import { ElementNotFoundError } from '@pkgs/ui-testing-root-shared/element-not-found-error';
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
  if (await visible(s, actor, [Handles.gameChoice('puzzle')]))
    return 'ChessChoices';
  if (await visible(s, actor, [Handles.gameMenu('chess')])) return 'GameChoice';
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
  // Reconnect can replace the allowance after the visibility probe. Its
  // absence is a normal loading state; keep observing the room as it settles.
  const text = await ui
    .get('chess-puzzle-remaining-today')
    .text()
    .catch((error) => {
      if (error instanceof ElementNotFoundError) return null;
      throw error;
    });
  const match = text?.match(/^\s*(\d+)/);
  return match === null || match === undefined ? null : Number(match[1]);
}
