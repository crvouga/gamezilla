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
  Handles.gameChoice('puzzle'),
  Handles.spaceHostChoosesGame,
  Handles.statusConnectionMissing,
] as const;

const BACK_OR_REFUSAL = [
  Handles.gameMenu('chess'),
  Handles.spaceHostChoosesGame,
  Handles.statusConnectionMissing,
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
  return visible(s, actorId, [Handles.gameMenu('chess')]);
}

export function connectionMissingShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.statusConnectionMissing]);
}

export const attemptSelectChessGame = scenarioAction({
  name: 'attemptSelectChessGame',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    if (!(await ui.get(Handles.gameMenu('chess')).isVisible())) return;
    if (await ui.get(Handles.spaceHostChoosesGame).isVisible()) return;
    await ui.get(Handles.gameMenu('chess')).tap();
    await waitForOneOf(s, actorId, CHOOSE_OR_REFUSAL, 'chess, or why not');
  },
});

export const attemptLeaveChessMenu = scenarioAction({
  name: 'attemptLeaveChessMenu',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    if (!(await ui.get(Handles.gameChoice('puzzle')).isVisible())) return;
    await ui.get(Handles.navBack).tap();
    await waitForOneOf(
      s,
      actorId,
      BACK_OR_REFUSAL,
      'the game choice, or why not'
    );
  },
});
