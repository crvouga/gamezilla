import { expect, test } from 'bun:test';
import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import { attemptCustomGame } from '@libs/game-session-harness-ts/custom-game-ui';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import { openConformanceHarness } from './conformance-world';

const openHistory = scenarioAction({
  name: 'openHistoryFromCustomGame',
  act: async (s) => {
    const ui = await actorUi(s, 'alice');
    await ui.get('custom-game-history-stats').tap();
  },
});

test('Pong cancelled-game history navigation leaves the live board once', async () => {
  // regression: pong-history-navigation
  await using s = await openConformanceHarness('pong-history-navigation');
  await s.apply(establishCustomGame, 'pong', { second: 'open', active: false });
  await s.apply(attemptCustomGame, 'alice', { operation: 'cancel' });
  await s.apply(openHistory);
  await s.advanceTime(1000);
  const actual = await s.read(async (world) => ({
    rooms: world.harness.roomNode.listTopics().map((topic) => {
      const state = world.harness.roomNode.inspect(topic)?.committedState ?? {};
      return {
        topic,
        selected: GamesRoomAttr.selected.from(state),
        screen: GamesRoomAttr.screen.from(state),
      };
    }),
    history: await (await actorUi(world, 'alice'))
      .get('game-history-statistics')
      .isVisible(),
  }));
  expect(actual).toMatchObject({ history: true });
});
