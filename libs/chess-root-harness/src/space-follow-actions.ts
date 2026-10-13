/**
 * Choosing what a space plays, including the attempts that do not land:
 * the control is absent, the person is not the host, or the connection
 * is missing.
 */

import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { visible } from '@libs/harness/observations';
import { waitForOneOf } from '@libs/spaces-harness/space-ui';
import { Handles } from '@libs/test-ids-shared/handles';

const CHOOSE_OR_REFUSAL = [
  Handles.chessMenuPuzzle,
  Handles.spaceHostChoosesGame,
  Handles.notificationsConnectionMissing,
] as const;

const BACK_OR_REFUSAL = [
  Handles.gameMenuChess,
  Handles.spaceHostChoosesGame,
  Handles.notificationsConnectionMissing,
] as const;

export function hostChoosesShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.spaceHostChoosesGame]);
}

export function gameChoiceShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.gameMenuChess]);
}

export function connectionMissingShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.notificationsConnectionMissing]);
}

export const attemptSelectChessGame = scenarioAction({
  name: 'attemptSelectChessGame',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    if (!(await ui.get(Handles.gameMenuChess).isVisible())) return;
    if (await ui.get(Handles.spaceHostChoosesGame).isVisible()) return;
    await ui.get(Handles.gameMenuChess).tap();
    await waitForOneOf(s, actorId, CHOOSE_OR_REFUSAL, 'chess, or why not');
  },
});

export const attemptLeaveChessMenu = scenarioAction({
  name: 'attemptLeaveChessMenu',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    if (!(await ui.get(Handles.chessMenuPuzzle).isVisible())) return;
    await ui.get(Handles.navBack).tap();
    await waitForOneOf(
      s,
      actorId,
      BACK_OR_REFUSAL,
      'the game choice, or why not'
    );
  },
});
