import { expect, test } from 'bun:test';
import {
  establishQuoridor,
  placeQuoridorWall,
  quoridorView,
} from '@libs/quoridor-harness-ts/quoridor-actions';
import { openHarness } from './open-quoridor-harness';

// regression: quoridor-empty-wall-inventory-guidance
test('seed 1 explains an exhausted wall inventory and refuses d4h without changing the game', async () => {
  await using s = await openHarness('quoridor-empty-walls', { seed: 1 });
  await s.apply(establishQuoridor, { fixture: 'no-walls' });
  const before = await s.read(quoridorView);
  expect(before.game.remaining[0]).toBe(0);
  expect(before.wallStatus).toContain('no walls left');
  expect(before.wallStatus).toContain('Move your pawn');
  await s.apply(placeQuoridorWall, 'alice', {
    orientation: 'horizontal',
    cell: 'd4',
  });
  const after = await s.read(quoridorView);
  expect(after.wallStatus).toContain('no walls left');
  expect(after.current).toEqual(before.current);
  expect(after.game).toEqual(before.game);
}, 60_000);
