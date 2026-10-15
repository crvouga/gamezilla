import { expect, test } from 'bun:test';
import {
  opponentRetryDelays,
  retryWaitingOpponents,
} from '@libs/chess-matchmaking-harness/multiplayer-formation-retry';
import { prepareConnectFourSearch } from '@libs/connect-four-harness/connect-four-matchmaking';
import { openHarness } from './open-chess-harness';

// regression: shared-formation-retry-chess-pool-only
test('waiting Connect Four opponents receive the shared expanding-range retry', async () => {
  await using s = await openHarness('connect-four-formation-retry');
  await s.apply(prepareConnectFourSearch, 'alice');
  await s.apply(retryWaitingOpponents);
  expect(await s.read(opponentRetryDelays)).toEqual([5000]);
}, 120_000);
