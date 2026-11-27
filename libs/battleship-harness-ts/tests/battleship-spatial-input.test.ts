import { expect, test } from 'bun:test';
import {
  rotateBattleshipShip,
  showFleetSetup,
} from '@libs/battleship-harness-ts/battleship-actions';
import { RED_SHIP_CELLS } from '@libs/battleship-harness-ts/battleship-fixtures';
import {
  battleshipView,
  shipCells,
} from '@libs/battleship-harness-ts/battleship-view';
import { configureCustomGameChoice } from '@libs/game-session-harness-ts/custom-game-ui';
import { openCustomGames } from '@libs/game-session-harness-ts/game-navigation';
import { cutConnection } from '@libs/harness-ts/platform';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import { openHarness } from './open-battleship-harness';

// regression: battleship-ready-fleet-disconnect-timeout
// regression: battleship-locked-spatial-picker-harness
// Literal model prefix: arranged fleet, Bob loses connection, rotates Carrier.
test('a disconnected ready fleet does not open a disabled ship picker', async () => {
  await using s = await openHarness();
  await s.apply(createSpace, 'bob');
  await s.apply(openCustomGames, 'bob', 'battleship');
  await s.apply(configureCustomGameChoice, 'bob', {
    operation: 'create',
    game: 'battleship',
  });
  await s.apply(configureCustomGameChoice, 'bob', { operation: 'swap' });
  await s.apply(configureCustomGameChoice, 'bob', { operation: 'ready' });
  await s.apply(showFleetSetup, 'bob');
  const before = await s.read(battleshipView, 'bob');
  expect(before.screen.mySide).toBe('black');
  expect(before.screen.current?.ready).toContain('black');
  expect(before.screen.connected).toBe(true);
  expect(shipCells(before.setup, 'carrier')).toEqual(RED_SHIP_CELLS.carrier);
  await cutConnection({ s }, 'bob');
  await s.apply(rotateBattleshipShip, 'bob', 'carrier');
  const after = await s.read(battleshipView, 'bob');
  expect(after.screen.connected).toBe(false);
  expect(after.setup).toEqual(before.setup);
});
