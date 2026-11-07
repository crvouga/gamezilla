import { expect, test } from 'bun:test';
import {
  establishBattleship,
  placeBattleshipShip,
  rotateBattleshipShip,
} from '@libs/battleship-harness-ts/battleship-actions';
import {
  battleshipSetupRefusal,
  battleshipView,
} from '@libs/battleship-harness-ts/battleship-view';
import { cutConnection } from '@libs/harness-ts/platform';
import { openHarness } from './open-battleship-harness';

// regression: battleship-inert-overview-skips-harness-input
// Literal feature failure: the overview became inert, so no keyboard input ran.
test('the setup adapter attempts Carrier at G1 through the visible precision controls', async () => {
  await using s = await openHarness('battleship-inert-overview-g1');
  await s.apply(establishBattleship, { ready: false, active: false });
  await s.apply(
    placeBattleshipShip,
    'alice',
    {
      ship: 'carrier',
      cell: 'g1',
      orientation: 'h',
    },
    true
  );
  expect(await s.read(battleshipSetupRefusal, 'alice')).toContain('fit');
});

// regression: battleship-locked-spatial-picker-harness
// Literal model prefix: arranged fleet, Bob loses connection, rotates Carrier.
test('a disconnected ready fleet does not open a disabled ship picker', async () => {
  await using s = await openHarness('battleship-locked-carrier');
  await s.apply(establishBattleship, { ready: true, active: false });
  const before = (await s.read(battleshipView, 'bob')).setup;
  await cutConnection({ s }, 'bob');
  await s.apply(rotateBattleshipShip, 'bob', 'carrier');
  expect((await s.read(battleshipView, 'bob')).setup).toEqual(before);
});
