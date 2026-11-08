import { expect, test } from 'bun:test';
import { stayAwayInRound } from '@libs/light-cycles-harness-ts/light-cycles-away';
import { establishLightCyclesGame } from '@libs/light-cycles-harness-ts/light-cycles-lineup';
import {
  arenaShown,
  bannersShown,
} from '@libs/light-cycles-harness-ts/light-cycles-reads';
import {
  endCountdown,
  reachRoundCountdown,
} from '@libs/light-cycles-harness-ts/light-cycles-riding-actions';
import { openHarness } from './open-light-cycles-harness';

// regression: light-cycles-result-read-from-empty-overlay
test('seed 1 reads Nova winning round three after Alice and Bob sit out', async () => {
  await using s = await openHarness('light-cycles-result-reading', { seed: 1 });
  await s.apply(establishLightCyclesGame, {
    count: 3,
    riders: { Comet: 'alice', Ember: 'bob', Nova: 'carol' },
  });
  await s.apply(stayAwayInRound, ['alice', 'bob'], 2);
  await s.apply(reachRoundCountdown, 3);
  expect(await s.read(arenaShown)).toMatchObject({
    round: 3,
    phase: 'countdown',
  });
  await s.apply(endCountdown);
  const banners = await s.until(bannersShown, {
    maxMs: 2000,
    pred: (shown) =>
      shown.length === 1 && shown[0]!.startsWith('Nova wins the round.'),
  });
  expect(banners[0]).toStartWith('Nova wins the round.');
}, 60_000);
