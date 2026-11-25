import { expect, test } from 'bun:test';
import { readRound } from '@libs/light-cycles-harness-ts/light-cycles-board-view';
import { establishLightCyclesGame } from '@libs/light-cycles-harness-ts/light-cycles-lineup';
import { arenaShown } from '@libs/light-cycles-harness-ts/light-cycles-reads';
import { reachRoundCountdown } from '@libs/light-cycles-harness-ts/light-cycles-riding-actions';
import { openHarness } from './open-light-cycles-harness';

// regression: light-cycles-countdown-read-before-live
test('a just-started Duel is read counting down from 3 once it reaches the arena', async () => {
  await using s = await openHarness({
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

// regression: light-cycles-overlapping-browser-reads
test('one native browser can read the active round while steering', async () => {
  let pending = false;
  const values: Record<string, string> = {
    'data-round': '1',
    'data-phase': 'running',
    'data-dimmed': 'false',
  };
  const ui = {
    get: () => ({
      async attribute(name: string) {
        if (pending)
          throw new Error('Invalid state: an evaluate() is already pending');
        pending = true;
        await Promise.resolve();
        pending = false;
        return values[name] ?? null;
      },
    }),
  };
  expect(await readRound(ui, 'custom-game-board')).toEqual({
    round: 1,
    phase: 'running',
    live: true,
  });
});
