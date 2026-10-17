import { expect, test } from 'bun:test';
import {
  opponentRetryDelays,
  retryWaitingOpponents,
} from '@libs/game-matchmaking-harness/multiplayer-formation-retry';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { seekGameOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { openHarness } from './open-connect-four-harness';

// regression: shared-formation-retry-chess-pool-only
// regression: formation-retry-observation-consumes-time
test('waiting Connect Four opponents receive the shared expanding-range retry', async () => {
  await using s = await openHarness('connect-four-formation-retry');
  await s.apply(seekGameOpponent, 'alice', 'connect-four');
  await s.apply(retryWaitingOpponents);
  const deadline = await s.read(async (state) => {
    const joined = (await multiplayerView(state, 'alice')).search?.joined_at_ms;
    if (joined === null || joined === undefined)
      throw new Error('No waiting search');
    const delays = await opponentRetryDelays(state);
    return { joined, at: state.harness.clock.now(), delays };
  });
  expect(deadline.delays.map((delay) => deadline.at + delay)).toEqual([
    deadline.joined + 5000,
  ]);
}, 120_000);
