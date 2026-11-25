import { expect, test } from 'bun:test';
import { readCustomGameScreen } from '@libs/game-session-harness-ts/custom-game-screen';
import { openHarness } from './open-chess-harness';
import { customHumans, customSpace } from './steps/custom-game-world';

// regression: chess-board-before-member-joins
test('Bob joins Alice as Black and Carol watches the same custom game', async () => {
  await using s = await openHarness();
  const world = { s, memo: new Map<string, unknown>() };
  await customHumans(world, { host: 'alice', white: 'alice', black: 'bob' });
  await customSpace(world, 'alice', ['carol']);
  const bob = await s.read(readCustomGameScreen, 'bob');
  const carol = await s.read(readCustomGameScreen, 'carol');
  expect(bob?.mySide).toBe('black');
  expect(bob?.current?.id).toBeDefined();
  expect(carol?.current?.id).toBe(bob?.current?.id);
}, 30_000);
