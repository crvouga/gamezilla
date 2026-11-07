import { expect, test } from 'bun:test';
import {
  establishBattleship,
  placeBattleshipShip,
} from '@libs/battleship-harness-ts/battleship-actions';
import { battleshipSetupRefusal } from '@libs/battleship-harness-ts/battleship-view';
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
