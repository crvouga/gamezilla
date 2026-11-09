import { expect, test } from 'bun:test';
import {
  establishQuoridor,
  moveQuoridorPawn,
  placeQuoridorWall,
  quoridorView,
} from '@libs/quoridor-harness-ts/quoridor-actions';
import { openHarness } from './open-quoridor-harness';

// regression: quoridor-spectator-missing-tools
test('seed 1 sends spectator pawn and wall attempts through the product refusal', async () => {
  await using s = await openHarness('quoridor-spectator-actions', { seed: 1 });
  await s.apply(establishQuoridor, { watchers: ['eve'] });
  const before = await s.read(quoridorView);
  await s.apply(moveQuoridorPawn, 'eve', 'e2');
  expect((await s.read(quoridorView, 'eve')).error).toBe(
    'only the participant to move may play'
  );
  expect((await s.read(quoridorView)).current).toEqual(before.current);
  expect((await s.read(quoridorView)).game).toEqual(before.game);
  await s.apply(placeQuoridorWall, 'eve', {
    orientation: 'horizontal',
    cell: 'd2',
  });
  expect((await s.read(quoridorView, 'eve')).error).toBe(
    'only the participant to move may play'
  );
  expect((await s.read(quoridorView)).current).toEqual(before.current);
  expect((await s.read(quoridorView)).game).toEqual(before.game);
}, 60_000);
