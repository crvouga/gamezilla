/**
 * Leaving the chess choices for the space's game choice, including the
 * attempts that do not land: the person is not the host, or the connection
 * is missing.
 */

import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import { waitForOneOf } from '@libs/spaces-harness/space-ui';
import { Handles } from '@libs/test-ids-shared/handles';

const BACK_OR_REFUSAL = [
  Handles.gameMenu('chess'),
  Handles.spaceHostChoosesGame,
  Handles.statusConnectionMissing,
] as const;

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
