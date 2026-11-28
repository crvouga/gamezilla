import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { openMoreChoices } from './game-more-choices';
import { openGameSessionPlace } from './game-session-places';

/** The controls that open the moves place: from the live board, and from a result. */
const MOVES_PLACE_ROWS = [
  'game-session-all-moves',
  'game-session-review-start',
];

/** Review the board after `ply` moves of the shown game session. */
export const reviewGameSessionMove = scenarioAction({
  name: 'reviewGameSessionMove',
  act: async (s, actor: string, ply: number) => {
    const ui = await actorUi(s, actor);
    const jump = ui.get('game-session-review-ply');
    if (!(await jump.isVisible())) {
      for (const row of MOVES_PLACE_ROWS)
        if (
          await openGameSessionPlace(s, actor, row, 'game-session-go-to-move')
        )
          break;
      await ui.get('game-session-go-to-move').tap();
    }
    await jump.clear();
    await jump.input(String(ply));
    await ui.get('game-session-review-seek').tap();
    if (!(await ui.get('game-session-error').isVisible()))
      await ui.key('escape');
  },
});

/**
 * Open the game's history: from the game session shown (its result, or its
 * game menu while it is played), else from the game's choices, going back
 * to them first.
 */
export const openGameHistory = scenarioAction({
  name: 'openGameHistory',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    await pollUntil(
      s,
      async () => {
        if (await ui.get('game-history-statistics').isVisible()) return true;
        // On the game's menu, History and stats waits behind More.
        await openMoreChoices(ui);
        if (await ui.get('game-session-history-stats').isVisible())
          await ui.get('game-session-history-stats').tap();
        // While a game is played the way to the history is a row of its
        // game menu: a person opens the menu first.
        else if (await ui.get('game-session-commands').isVisible())
          await ui.get('game-session-commands').tap();
        // Behind History and stats when the game also keeps puzzle stats.
        else if (await ui.get(Handles.gameChoice('game-history')).isVisible())
          await ui.get(Handles.gameChoice('game-history')).tap();
        else if (await ui.get(Handles.gameChoice('history')).isVisible())
          await ui.get(Handles.gameChoice('history')).tap();
        else await ui.get(Handles.navBack).tap();
        return null;
      },
      { maxMs: 15_000, stepMs: 1, description: `${actor} opens the history` }
    );
  },
});

/** The victories, losses and draws the shown history counts. */
export async function gameHistoryStatistics(s: ProductHarness, actor: string) {
  const ui = await actorUi(s, actor);
  const stats = ui.get('game-history-statistics');
  return {
    wins: Number(await stats.attribute('data-wins')),
    losses: Number(await stats.attribute('data-losses')),
    draws: Number(await stats.attribute('data-draws')),
    record: (await ui.get('game-history-record').isVisible())
      ? ((await ui.get('game-history-record').text()) ?? '')
      : '',
  };
}
