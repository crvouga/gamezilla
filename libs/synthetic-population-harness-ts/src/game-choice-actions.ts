import { GAME_AUTOMATIONS } from '@libs/game-catalog-shared-ts/game-automations';
import { HARNESS_GAMES } from '@libs/games-harness-ts/harness-games';
import {
  actorUi,
  ensureActor,
  scenarioAction,
} from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import { SyntheticUserApplication } from '@libs/synthetic-population-shared-ts/synthetic-user-application';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { syntheticGameAdapter } from './synthetic-game-actions';
import { givenSyntheticUser } from './synthetic-user-fixtures';

export const givenSyntheticGameChoice = scenarioAction({
  name: 'givenSyntheticGameChoice',
  act: async (s, name: string) => {
    await Promise.resolve(givenSyntheticUser.act(s, name, false));
    await Promise.resolve(backToTabs.act(s, 'cedar'));
    await (await actorUi(s, 'cedar')).get(Handles.tabSpaces).tap();
    await ensureActor(s, 'bob');
  },
});
export const startSyntheticActivity = scenarioAction({
  name: 'startSyntheticActivity',
  act: async (s, game: string) => {
    const selected = syntheticGameAdapter(game);
    const index = GAME_AUTOMATIONS.indexOf(selected);
    const ui = await actorUi(s, 'cedar');
    const application = new SyntheticUserApplication(ui, {
      games: GAME_AUTOMATIONS,
      clock: s.harness.clock,
      random: () => (index + 0.5) / GAME_AUTOMATIONS.length,
      username: 'cedar',
      emit: () => undefined,
    });
    application.authenticated();
    try {
      // Normal autonomous ticks create a space, choose a game, then enter its queue.
      for (let tick = 0; tick < 6; tick += 1) {
        if (await ui.get('multiplayer-waiting').isVisible()) return;
        await application.tick({
          paused: false,
          draining: false,
          elapsedMs: 0,
          sessionMs: 60_000,
          hostingWeight: 1,
        });
        await s.session.waitForIdle();
      }
    } finally {
      application.close();
    }
  },
});
export async function syntheticGameChoice(s: ProductHarness) {
  const ui = await actorUi(s, 'cedar');
  const seekingOpponent = await ui.get('multiplayer-waiting').isVisible();
  const text = seekingOpponent
    ? await ui.get('multiplayer-waiting').text()
    : null;
  return {
    chosenGame:
      HARNESS_GAMES.find((game) =>
        text?.toLowerCase().includes(game.label.toLowerCase())
      )?.label ?? '',
    seekingOpponent,
  };
}
