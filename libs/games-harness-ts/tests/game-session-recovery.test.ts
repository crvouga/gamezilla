import { expect, test } from 'bun:test';
import {
  goBackInGame,
  openGameChoice,
  switchSpaceGame,
} from '@libs/game-session-harness-ts/game-navigation';
import { operateGameSession } from '@libs/game-session-harness-ts/game-session-controls';
import {
  establishGameSession,
  returnToGameSessions,
} from '@libs/game-session-harness-ts/game-session-lineup';
import { gameSessionView } from '@libs/game-session-harness-ts/game-session-probe';
import { restartApp } from '@libs/harness-ts/actions';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { PONG_HARNESS_GAME } from '@libs/pong-harness-ts/pong-harness-game';
import { QUORIDOR_HARNESS_GAME } from '@libs/quoridor-harness-ts/quoridor-harness-game';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { openConformanceHarness } from './conformance-world';

const playBot = scenarioAction({
  name: 'playBotFromGameSessionSetup',
  act: async (s) => {
    const ui = await actorUi(s, 'alice');
    await goBackInGame.act(s, 'alice');
    await openGameChoice.act(s, 'alice', 'vs-bot');
    await ui.get('game-session-create').tap();
    await ui.get('game-session-ready').tap();
    await ui.get('game-session-start').tap();
  },
});

// regression: game-session-hidden-by-game-choice
test('Pong opens the unfinished Quoridor setup, then starts a bot game once it is cancelled', async () => {
  await using s = await openConformanceHarness();
  await s.apply(establishGameSession, QUORIDOR_HARNESS_GAME.shared.id, {
    second: 'open',
    ready: false,
    active: false,
  });
  const original = await s.read(gameSessionView, 'alice');
  await s.apply(switchSpaceGame, 'alice', 'pong');
  const options = await s.read(async (world) => {
    const ui = await actorUi(world, 'alice');
    return {
      title: await ui.get('game-session-mode').text(),
      bot: await ui.get('play-bots-setup-seats').isVisible(),
    };
  });
  expect(options.title).toContain('Quoridor');
  expect(options.bot).toBe(false);
  expect((await s.read(gameSessionView, 'alice')).current).toEqual(
    original.current
  );
  const link = await s.read(readSpaceLink, 'alice');
  if (link === null) throw new Error('Alice has no space to reopen');
  await s.apply(restartApp, 'alice');
  await s.apply(returnToGameSessions, 'pong', 'alice', link);
  expect((await s.read(gameSessionView, 'alice')).current).toEqual(
    original.current
  );
  await s.apply(operateGameSession, 'alice', { operation: 'cancel' });
  await s.apply(playBot);
  const pong = await s.until((world) => gameSessionView(world, 'alice'), {
    pred: (seen) => seen.current?.status === 'active',
  });
  expect(pong.current?.black.kind).toBe('bot');
  expect(pong.current?.id).not.toBe(original.current?.id);
  expect(
    PONG_HARNESS_GAME.shared.registration.rules.recognizes(pong.displayFen)
  ).toBe(true);
}, 120_000);
