import { expect, test } from 'bun:test';
import {
  pairConnectFourOpponents,
  prepareConnectFourSearch,
} from '@libs/connect-four-harness/connect-four-matchmaking';
import { actorHtml } from '@libs/harness/observations';
import { openHarness } from './open-chess-harness';

// regression: shared-clock-spoken-chess-colours
test('Connect Four clock announcements use its registered disc identities', async () => {
  await using s = await openHarness('connect-four-spoken-clocks');
  await s.apply(prepareConnectFourSearch, 'alice');
  await s.apply(prepareConnectFourSearch, 'bob');
  await s.apply(pairConnectFourOpponents);
  const html = (await s.read(actorHtml, 'alice')) ?? '';
  expect(html).toContain('Red circle has 5:00 left');
  expect(html).toContain('Yellow diamond has 5:00 left');
  expect(html).not.toContain('White has');
  expect(html).not.toContain('Black has');
}, 120_000);
