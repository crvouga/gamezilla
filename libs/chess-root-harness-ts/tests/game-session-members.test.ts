import { expect, test } from 'bun:test';
import { readGameSessionScreen } from '@libs/game-session-harness-ts/game-session-screen';
import { openHarness } from './open-chess-harness';
import { customHumans, customSpace } from './steps/game-session-world';

// regression: chess-board-before-member-joins
test('Bob joins Alice as Black and Carol watches the same game session', async () => {
  await using s = await openHarness();
  const world = { s, memo: new Map<string, unknown>() };
  await customHumans(world, { host: 'alice', white: 'alice', black: 'bob' });
  await customSpace(world, 'alice', ['carol']);
  const bob = await s.read(readGameSessionScreen, 'bob');
  const carol = await s.read(readGameSessionScreen, 'carol');
  expect(bob?.mySide).toBe('black');
  expect(bob?.current?.id).toBeDefined();
  expect(carol?.current?.id).toBe(bob?.current?.id);
}, 30_000);
