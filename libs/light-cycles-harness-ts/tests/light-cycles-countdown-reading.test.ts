import { expect, test } from 'bun:test';
import { establishLightCyclesGame } from '@libs/light-cycles-harness-ts/light-cycles-lineup';
import { arenaShown } from '@libs/light-cycles-harness-ts/light-cycles-reads';
import { reachRoundCountdown } from '@libs/light-cycles-harness-ts/light-cycles-riding-actions';
import { openHarness } from './open-light-cycles-harness';

// regression: light-cycles-countdown-read-before-live
test('a just-started Duel is read counting down from 3 once it reaches the arena', async () => {
  await using s = await openHarness('light-cycles-countdown-reading', {
    seed: 1,
  });
  await s.apply(establishLightCyclesGame, {
    count: 2,
    riders: { Comet: 'alice', Ember: 'bob' },
  });
  await s.apply(reachRoundCountdown, 1);
  const shown = await s.read(arenaShown);
  expect(shown.live).toBe(true);
  expect(shown.overlay).toStartWith('3');
}, 60_000);
