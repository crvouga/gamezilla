import { expect, test } from 'bun:test';
import { changeCustomGame } from '@libs/chess-custom-game-harness/custom-game-actions';
import { establishConnectFour } from '@libs/connect-four-harness/connect-four-actions';
import {
  connectFourHistoryStatistics,
  openConnectFourHistory,
} from '@libs/connect-four-harness/connect-four-review';
import { openHarness } from './open-chess-harness';

// regression: cancelled-history-invents-bot
test('a cancelled game with an unfilled place records no invented bot or result', async () => {
  await using s = await openHarness('cancelled-history-unfilled-place');
  await s.apply(establishConnectFour, { yellow: 'open', active: false });
  await s.apply(changeCustomGame, 'alice', { operation: 'cancel' });
  await s.apply(openConnectFourHistory, 'alice');
  const history = await s.read(connectFourHistoryStatistics, 'alice');
  expect(history.record).toContain('No participant');
  expect(history.record).toContain('Game cancelled');
  expect(history.record).not.toContain('Bot');
  expect([history.wins, history.losses, history.draws]).toEqual([0, 0, 0]);
}, 120_000);
