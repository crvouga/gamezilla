import { GAME_AUTOMATIONS } from '@libs/game-catalog-shared-ts/game-automations';
import { actorUi, pollUntil } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import type { ApplicationEvent } from '@libs/synthetic-population-shared-ts/application-events';
import { SyntheticUserApplication } from '@libs/synthetic-population-shared-ts/synthetic-user-application';
import { syntheticGameView } from './synthetic-game-actions';

/** Continues only the current match; administrative pause never abandons it. */
export async function playSyntheticCurrentGame(
  s: ProductHarness,
  emit: (event: ApplicationEvent) => void
): Promise<void> {
  await bringToFront(s, 'cedar');
  const driver = await actorUi(s, 'cedar');
  const application = new SyntheticUserApplication(driver, {
    games: GAME_AUTOMATIONS,
    clock: s.harness.clock,
    random: s.session.ports.random,
    username: 'cedar',
    emit,
  });
  application.authenticated();
  try {
    await application.continueCurrentGame();
    if (await driver.get('multiplayer-offline').isVisible()) return;
    await pollUntil(
      s,
      async () => {
        await application.continueCurrentGame();
        const game = await syntheticGameView(s);
        return game.outcome !== null && game.outcome !== 'ongoing'
          ? game
          : null;
      },
      {
        maxMs: 180_000,
        description: 'Cedar continues the current game to its result',
      }
    );
  } finally {
    application.close();
  }
}
