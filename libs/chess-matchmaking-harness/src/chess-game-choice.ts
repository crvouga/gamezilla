import { chessRules } from '@libs/chess-rules-shared/chess-rules';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import { SPACE_WAIT_MS, waitForOneOf } from '@libs/spaces-harness/space-ui';
import { Handles } from '@libs/test-ids-shared/handles';

/** `actorId` chooses chess in their space, when the game choice offers it. */
export const selectChessGame = scenarioAction({
  name: 'selectChessGame',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    const choice = Handles.gameMenu(chessRules.id);
    if (!(await ui.get(choice).isVisible())) return;
    await ui.get(choice).tap({ timeoutMs: SPACE_WAIT_MS });
    await waitForOneOf(
      s,
      actorId,
      [
        Handles.gameChoice('puzzle'),
        Handles.gameChoiceRefused,
        Handles.connectionMissing,
        Handles.statusConnectionMissing,
      ],
      'chess, or why the choice was refused'
    );
  },
});
