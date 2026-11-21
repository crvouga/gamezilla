import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { openCustomGamePlace } from './custom-game-places';
import { CUSTOM_GAME_ASIDE } from './custom-game-reads';

/** Review the board after `ply` moves of the shown custom game. */
export const reviewCustomGameMove = scenarioAction({
  name: 'reviewCustomGameMove',
  act: async (s, actor: string, ply: number) => {
    const ui = await actorUi(s, actor);
    // Stepping through the moves is a place of its own, as a person opens
    // it: the move list from the status line, then Review moves in it.
    if (!(await ui.get('custom-game-review-ply').isVisible())) {
      await openCustomGamePlace(
        s,
        actor,
        CUSTOM_GAME_ASIDE,
        'custom-game-review-jump'
      );
      await openCustomGamePlace(
        s,
        actor,
        'custom-game-review-jump',
        'custom-game-review-ply'
      );
    }
    await ui.get('custom-game-review-ply').clear();
    await ui.get('custom-game-review-ply').input(String(ply));
    await ui.get('custom-game-review-seek').tap();
  },
});

/**
 * Open the game's history: from the custom game shown (its result, or its
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
        if (await ui.get('custom-game-history-stats').isVisible())
          await ui.get('custom-game-history-stats').tap();
        // While a game is played or over the way to the history opens from
        // its status line: a person opens it first.
        else if (await ui.get(CUSTOM_GAME_ASIDE).isVisible())
          await ui.get(CUSTOM_GAME_ASIDE).tap();
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
