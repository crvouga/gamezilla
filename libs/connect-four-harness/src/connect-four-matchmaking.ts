import { sendMultiplayerCommand } from '@libs/game-matchmaking-harness/multiplayer-commands';
import { pairGameOpponents } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { requestGameOpponent } from '@libs/game-matchmaking-harness/multiplayer-search-ui';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import { backToTabs } from '@libs/harness/shell-actions';
import { createSpace } from '@libs/spaces-harness/space-actions';
export const prepareConnectFourSearch = scenarioAction({
  name: 'prepareConnectFourSearch',
  act: async (s, actor: string, game = 'connect-four') => {
    await Promise.resolve(signInWithGoogle.act(s, actor));
    await Promise.resolve(backToTabs.act(s, actor));
    await Promise.resolve(createSpace.act(s, actor));
    const ui = await actorUi(s, actor);
    await ui.get(`game-menu-${game}`).tap();
    await ui
      .get(
        game === 'connect-four'
          ? 'connect-four-multiplayer'
          : 'chess-menu-multiplayer'
      )
      .tap();
    await Promise.resolve(requestGameOpponent.act(s, actor, '5+0'));
  },
});
export const pairConnectFourOpponents = scenarioAction({
  name: 'pairConnectFourOpponents',
  act: (s) => pairGameOpponents.act(s, 'alice', true),
});
export const stopConnectFourSearch = scenarioAction({
  name: 'stopConnectFourSearch',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    await ui.get('multiplayer-stop').tap();
  },
});
export async function connectFourSearchView(s: ProductHarness, actor: string) {
  const ui = await actorUi(s, actor);
  const view = await multiplayerView(s, actor);
  return {
    ...view,
    waiting: await ui.get('multiplayer-waiting').isVisible(),
    board: (await ui.get('connect-four-board').isVisible())
      ? await ui.get('connect-four-board').attribute('data-cells')
      : null,
  };
}
export const CONNECT_FOUR_MATCHMAKING_ACTIONS = [
  prepareConnectFourSearch,
  pairConnectFourOpponents,
  stopConnectFourSearch,
];
export const requestConnectFourOpponent = scenarioAction({
  name: 'requestConnectFourOpponent',
  act: async (s) => {
    await Promise.resolve(signInWithGoogle.act(s, 'alice'));
    await Promise.resolve(backToTabs.act(s, 'alice'));
    await Promise.resolve(createSpace.act(s, 'alice'));
    const ui = await actorUi(s, 'alice');
    await ui.get('game-menu-connect-four').tap();
    await ui.get('connect-four-multiplayer').tap();
    await ui.get('multiplayer-find').tap();
  },
});

export const submitConcurrentConnectFourDrops = scenarioAction({
  name: 'submitConcurrentConnectFourDrops',
  act: async (s, gameId: string) => {
    await Promise.all(
      [2, 4].map((column) =>
        Promise.resolve(
          sendMultiplayerCommand.act(s, 'alice', {
            name: 'playMultiplayerMove',
            args: {
              gameId,
              revision: 0,
              uci: String(column),
              requestId: `concurrent-${column}`,
            },
          })
        )
      )
    );
  },
});
