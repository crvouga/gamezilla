import { expect, test } from 'bun:test';
import {
  establishGameSession,
  joinGameSessions,
  returnToGameSessions,
} from '@libs/game-session-harness-ts/game-session-lineup';
import { configureGameSessionChoice } from '@libs/game-session-harness-ts/game-session-ui';
import { restartApp } from '@libs/harness-ts/actions';
import { actorUi } from '@libs/harness-ts/actor-ui';
import { bringToFront, visible } from '@libs/harness-ts/observations';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { QUORIDOR_HARNESS_GAME } from '@libs/quoridor-harness-ts/quoridor-harness-game';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { openConformanceHarness } from './conformance-world';

const game = QUORIDOR_HARNESS_GAME.shared.id;

async function expectBoard(s: OpenHarness, actor: string) {
  await s.read(bringToFront, actor);
  for (const id of [
    'game-session-board',
    'game-session-white',
    'game-session-black',
  ]) {
    expect(await s.read(visible, actor, [id])).toBe(true);
  }
  const activeSeat = await s.read(async (world) => {
    const ui = await actorUi(world, actor);
    return ui.get('game-session-white').attribute('data-active');
  });
  expect(activeSeat).toBe('true');
  expect(await s.read(visible, actor, ['game-session-versus'])).toBe(false);
}

// regression: ready-game-board-covered
test.each(['bot', 'bob'])(
  'Classic Quoridor opens directly on the first turn against %s',
  async (second) => {
    await using s = await openConformanceHarness();
    await s.apply(establishGameSession, game, { second, active: false });
    await s.apply(configureGameSessionChoice, 'alice', { operation: 'start' });
    await expectBoard(s, 'alice');
    if (second === 'bob') await expectBoard(s, second);
  },
  60_000
);

test('a late join, a return and a ready rematch each open the current board', async () => {
  await using s = await openConformanceHarness();
  await s.apply(establishGameSession, game, {});
  await s.apply(joinGameSessions, game, 'alice', 'carol');
  await expectBoard(s, 'carol');
  const link = await s.read(readSpaceLink, 'alice');
  if (link === null) throw new Error('Alice has no space link');
  await s.apply(restartApp, 'bob');
  await s.apply(returnToGameSessions, game, 'bob', link);
  await expectBoard(s, 'bob');

  await s.apply(configureGameSessionChoice, 'alice', { operation: 'resign' });
  expect(await s.read(visible, 'alice', ['game-session-rematch'])).toBe(true);
  await s.apply(configureGameSessionChoice, 'alice', { operation: 'rematch' });
  for (const player of ['alice', 'bob']) {
    await s.apply(configureGameSessionChoice, player, { operation: 'ready' });
  }
  await s.apply(configureGameSessionChoice, 'alice', { operation: 'start' });
  await expectBoard(s, 'bob');
}, 60_000);
