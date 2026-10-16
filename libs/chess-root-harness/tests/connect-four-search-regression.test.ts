import { expect, test } from 'bun:test';
import {
  connectFourSearchView,
  requestConnectFourOpponent,
} from '@libs/connect-four-harness/connect-four-matchmaking';
import { openHarness } from './open-chess-harness';

// regression: game-session-ui-rules-port-missing
test('the fresh Connect Four Find control commits its namespaced search through the injected UI rules port', async () => {
  await using s = await openHarness('connect-four-find-ui-rules-port');
  await s.apply(requestConnectFourOpponent);
  const view = await s.until((world) => connectFourSearchView(world, 'alice'), {
    pred: (value) => value.search?.standing === 'waiting',
  });
  expect(view.search?.time_control).toBe('connect-four/5+0');
  expect(view.waiting).toBe(true);
}, 120_000);
