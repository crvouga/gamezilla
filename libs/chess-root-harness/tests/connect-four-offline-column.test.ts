import { expect, test } from 'bun:test';
import {
  clickConnectFourColumn,
  connectFourView,
  establishConnectFour,
} from '@libs/connect-four-harness/connect-four-actions';
import { partition } from '@libs/harness/actions';
import { openHarness } from './open-chess-harness';

// regression: game-session-offline-host-board-disabled
// regression: solo-custom-setup-self-invitation
test('an offline solo host can click column four and receive the local bot reply', async () => {
  await using s = await openHarness('offline-host-column-four');
  await s.apply(establishConnectFour, { yellow: 'bot' });
  await s.apply(partition, 'alice');
  await s.apply(clickConnectFourColumn, 'alice', 3);
  const played = await s.until(connectFourView, {
    maxMs: 5000,
    pred: (view) => view.game.moves.length === 2,
  });
  expect(played.game.moves[0]).toBe(3);
  expect(played.current?.turn).toBe('white');
}, 120_000);
