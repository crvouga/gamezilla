import { expect, test } from 'bun:test';
import {
  establishCustomGame,
  joinCustomGames,
  returnToCustomGames,
} from '@libs/game-session-harness-ts/custom-game-lineup';
import { configureCustomGameChoice } from '@libs/game-session-harness-ts/custom-game-ui';
import { actorUi } from '@libs/harness-ts/actor-ui';
import { restartApp } from '@libs/harness-ts/actions';
import { bringToFront, visible } from '@libs/harness-ts/observations';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { QUORIDOR_HARNESS_GAME } from '@libs/quoridor-harness-ts/quoridor-harness-game';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { openConformanceHarness } from './conformance-world';

const game = QUORIDOR_HARNESS_GAME.shared.id;

async function expectBoard(s: OpenHarness, actor: string) {
  await s.read(bringToFront, actor);
  for (const id of [
    'custom-game-board',
    'custom-game-white',
    'custom-game-black',
  ]) {
    expect(await s.read(visible, actor, [id])).toBe(true);
  }
  const activeSeat = await s.read(async (world) => {
    const ui = await actorUi(world, actor);
    return ui.get('custom-game-white').attribute('data-active');
  });
  expect(activeSeat).toBe('true');
  expect(await s.read(visible, actor, ['custom-game-versus'])).toBe(false);
}

// regression: ready-game-board-covered
test.each(['bot', 'bob'])(
  'Classic Quoridor opens directly on the first turn against %s',
  async (second) => {
    await using s = await openConformanceHarness();
    await s.apply(establishCustomGame, game, { second, active: false });
    await s.apply(configureCustomGameChoice, 'alice', { operation: 'start' });
    await expectBoard(s, 'alice');
    if (second === 'bob') await expectBoard(s, second);
  },
  60_000
);

test('a late join, a return and a ready rematch each open the current board', async () => {
  await using s = await openConformanceHarness();
  await s.apply(establishCustomGame, game, {});
  await s.apply(joinCustomGames, game, 'alice', 'carol');
  await expectBoard(s, 'carol');
  const link = await s.read(readSpaceLink, 'alice');
  if (link === null) throw new Error('Alice has no space link');
  await s.apply(restartApp, 'bob');
  await s.apply(returnToCustomGames, game, 'bob', link);
  await expectBoard(s, 'bob');

  await s.apply(configureCustomGameChoice, 'alice', { operation: 'resign' });
  expect(await s.read(visible, 'alice', ['custom-game-rematch'])).toBe(true);
  await s.apply(configureCustomGameChoice, 'alice', { operation: 'rematch' });
  for (const player of ['alice', 'bob']) {
    await s.apply(configureCustomGameChoice, player, { operation: 'ready' });
  }
  await s.apply(configureCustomGameChoice, 'alice', { operation: 'start' });
  await expectBoard(s, 'bob');
}, 60_000);
