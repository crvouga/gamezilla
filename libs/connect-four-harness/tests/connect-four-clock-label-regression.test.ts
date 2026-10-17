import { expect, test } from 'bun:test';
import { pairGameOpponents } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import { seekGameOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { actorHtml } from '@libs/harness/observations';
import { openHarness } from './open-connect-four-harness';

// regression: shared-clock-spoken-chess-colours
test('Connect Four clock announcements use its registered disc identities', async () => {
  await using s = await openHarness('connect-four-spoken-clocks');
  await s.apply(seekGameOpponent, 'alice', 'connect-four');
  await s.apply(seekGameOpponent, 'bob', 'connect-four');
  await s.apply(pairGameOpponents, 'alice', true);
  const html = (await s.read(actorHtml, 'alice')) ?? '';
  expect(html).toContain('Red circle has 5:00 left');
  expect(html).toContain('Yellow diamond has 5:00 left');
  expect(html).not.toContain('White has');
  expect(html).not.toContain('Black has');
}, 120_000);
