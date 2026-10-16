import { GAME_AUTOMATIONS } from '@libs/game-catalog-shared/game-automations';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { backToTabs } from '@libs/harness/shell-actions';
import {
  createSpace,
  returnToOwnSpace,
} from '@libs/spaces-harness/space-actions';
import { openMultiplayer } from '@libs/synthetic-population-shared/game-automation';

export function syntheticGameAdapter(name: string) {
  const id =
    name === 'chess'
      ? 'chess'
      : name === 'Connect Four'
        ? 'connect-four'
        : name;
  const game = GAME_AUTOMATIONS.find((entry) => entry.rules.id === id);
  if (game === undefined) throw new Error(`Unknown game ${name}`);
  return game;
}
export const givenSyntheticGameSpace = scenarioAction({
  name: 'givenSyntheticGameSpace',
  act: async (s, actor: string, name: string) => {
    await Promise.resolve(backToTabs.act(s, actor));
    await Promise.resolve(createSpace.act(s, actor));
    await openMultiplayer(
      await actorUi(s, actor),
      [syntheticGameAdapter(name)],
      () => 0
    );
  },
});
export const openSyntheticGame = scenarioAction({
  name: 'openSyntheticGame',
  act: async (s, actor: string, name?: string) => {
    await Promise.resolve(returnToOwnSpace.act(s, actor));
    const games =
      name === undefined ? GAME_AUTOMATIONS : [syntheticGameAdapter(name)];
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
    canMove: visible && (await game.attribute('data-can-move')) === 'true',
    announcement: (await ui.get('multiplayer-announcement').isVisible())
      ? await ui.get('multiplayer-announcement').text()
      : null,
  };
}
