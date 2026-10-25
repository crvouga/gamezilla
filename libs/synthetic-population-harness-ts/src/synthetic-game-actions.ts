import { GAME_AUTOMATIONS } from '@libs/game-catalog-shared-ts/game-automations';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { HARNESS_GAMES } from '@libs/games-harness-ts/harness-games';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import {
  createSpace,
  returnToOwnSpace,
} from '@libs/spaces-harness-ts/space-actions';
import { openMultiplayer } from '@libs/synthetic-population-shared-ts/game-automation';

/**
 * The registered game a synthetic-population spec names, by the name its
 * harness gives it ("chess", "Connect Four"); unnamed, the first registered
 * game offering matchmaking, which synthetic users play.
 */
export function syntheticGame(name?: string): HarnessGame {
  const game =
    name === undefined
      ? HARNESS_GAMES.find(
          (candidate) => candidate.shared.capabilities.matchmaking !== undefined
        )
      : HARNESS_GAMES.find(
          (candidate) =>
            candidate.label === name || candidate.shared.id === name
        );
  if (game === undefined) throw new Error(`Unknown game ${String(name)}`);
  return game;
}
export function syntheticGameAdapter(name?: string) {
  const game = syntheticGame(name);
  const automation = game.shared.automation;
  if (automation === undefined)
    throw new Error(`${game.label} has no registered automated play`);
  return automation;
}
export const givenSyntheticGameSpace = scenarioAction({
  name: 'givenSyntheticGameSpace',
  act: async (s, actor: string, name: string) => {
    await Promise.resolve(backToTabs.act(s, actor));
    await Promise.resolve(createSpace.act(s, actor));
    await openMultiplayer(
      await actorUi(s, actor),
      [{ rules: syntheticGame(name).shared.registration.rules }],
      () => 0
    );
  },
});
export const openSyntheticGame = scenarioAction({
  name: 'openSyntheticGame',
  act: async (s, actor: string, name?: string) => {
    await Promise.resolve(returnToOwnSpace.act(s, actor));
    const games =
      name === undefined
        ? GAME_AUTOMATIONS
        : [{ rules: syntheticGame(name).shared.registration.rules }];
    await openMultiplayer(await actorUi(s, actor), games, () => 0);
  },
});
export async function syntheticGameView(s: ProductHarness, actor = 'cedar') {
  const ui = await actorUi(s, actor);
  const game = ui.get('multiplayer-game');
  const visible = await game.isVisible();
  return {
    gameId: visible ? await game.attribute('data-game-id') : null,
    position: visible ? await game.attribute('data-fen') : null,
    outcome: visible ? await game.attribute('data-outcome') : null,
    reason: visible ? await game.attribute('data-reason') : null,
    canMove: visible && (await game.attribute('data-can-move')) === 'true',
    announcement: (await ui.get('multiplayer-announcement').isVisible())
      ? await ui.get('multiplayer-announcement').text()
      : null,
  };
}
