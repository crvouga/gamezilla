import { expect, test } from 'bun:test';
import { operateCustomGame } from '@libs/game-session-harness-ts/custom-game-controls';
import {
  establishCustomGame,
  returnToCustomGames,
} from '@libs/game-session-harness-ts/custom-game-lineup';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import { switchSpaceGame } from '@libs/game-session-harness-ts/game-navigation';
import { restartApp } from '@libs/harness-ts/actions';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { PONG_HARNESS_GAME } from '@libs/pong-harness-ts/pong-harness-game';
import { QUORIDOR_HARNESS_GAME } from '@libs/quoridor-harness-ts/quoridor-harness-game';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { openConformanceHarness } from './conformance-world';

const playBot = scenarioAction({
  name: 'playBotFromCustomGameSetup',
  act: async (s) =>
    (await actorUi(s, 'alice')).get('custom-game-play-bot').tap(),
});

// regression: custom-game-hidden-by-game-choice
test('Pong opens the unfinished Quoridor setup, then starts a bot game once it is cancelled', async () => {
  await using s = await openConformanceHarness();
  await s.apply(establishCustomGame, QUORIDOR_HARNESS_GAME.shared.id, {
    second: 'open',
    ready: false,
    active: false,
  });
  const original = await s.read(customGameView, 'alice');
  await s.apply(switchSpaceGame, 'alice', 'pong');
  const options = await s.read(async (world) => {
    const ui = await actorUi(world, 'alice');
    return {
      title: await ui.get('custom-game-mode').text(),
      bot: await ui.get('custom-game-play-bot').isVisible(),
    };
  });
  expect(options.title).toContain('Quoridor');
  expect(options.bot).toBe(false);
  expect((await s.read(customGameView, 'alice')).current).toEqual(
    original.current
  );
  const link = await s.read(readSpaceLink, 'alice');
  if (link === null) throw new Error('Alice has no space to reopen');
  await s.apply(restartApp, 'alice');
  await s.apply(returnToCustomGames, 'pong', 'alice', link);
  expect((await s.read(customGameView, 'alice')).current).toEqual(
    original.current
  );
  await s.apply(operateCustomGame, 'alice', { operation: 'cancel' });
  await s.apply(playBot);
  const pong = await s.until((world) => customGameView(world, 'alice'), {
    pred: (seen) => seen.current?.status === 'active',
  });
  expect(pong.current?.black.kind).toBe('bot');
  expect(pong.current?.id).not.toBe(original.current?.id);
  expect(
    PONG_HARNESS_GAME.shared.registration.rules.recognizes(pong.displayFen)
  ).toBe(true);
}, 120_000);
