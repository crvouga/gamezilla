import { expect, test } from 'bun:test';
import {
  opponentSearchView,
  seekGameOpponent,
} from '@libs/game-matchmaking-harness/opponent-seeking';
import { openHarness } from './open-connect-four-harness';

// regression: game-session-ui-rules-port-missing
test('the fresh Connect Four Find control commits its namespaced search through the injected UI rules port', async () => {
  await using s = await openHarness('connect-four-find-ui-rules-port');
  await s.apply(seekGameOpponent, 'alice', 'connect-four');
  const view = await s.until((world) => opponentSearchView(world, 'alice'), {
    pred: (value) => value.search?.standing === 'waiting',
  });
  expect(view.search?.time_control).toBe('connect-four/5+0');
  expect(view.waiting).toBe(true);
}, 120_000);
