import { expect, test } from 'bun:test';
import { connectFourView } from '@libs/connect-four-harness-ts/connect-four-actions';
import { establishConnectFourBotPosition } from '@libs/connect-four-harness-ts/connect-four-bots';
import { openHarness } from './open-connect-four-harness';

// regression: connect-four-solo-bot-tactical-precondition
test('the host shows the tactical drops before its Hard bot takes the winning column', async () => {
  await using s = await openHarness('connect-four-bot-tactical-host');
  await s.apply(establishConnectFourBotPosition, [0, 0, 1, 1, 2]);
  expect((await s.read(connectFourView)).game.moves).toHaveLength(9);
  await s.advanceTime(1000);
  expect((await s.read(connectFourView)).current?.outcome).toBe(
    'black wins by four in a row'
  );
}, 120_000);
