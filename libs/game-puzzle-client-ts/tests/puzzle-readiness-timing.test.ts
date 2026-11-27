import { expect, test } from 'bun:test';
import {
  createPuzzleReadinessTiming,
  timeNextPuzzle,
} from '@libs/game-puzzle-client-ts/puzzle-readiness-timing';
import { flush } from 'solid-js';

// regression: next-puzzle-ready-includes-driver-time
test('all twenty Next presses time the different playable board even when observed later', () => {
  let now = 0;
  const timing = createPuzzleReadinessTiming(() => now);
  for (let index = 0; index < 20; index++) {
    const from = String(index);
    const to = String(index + 1);
    now += 1050; // locating the control
    const press = timeNextPuzzle(
      timing,
      () => from,
      () => {
        now += 100; // work in the actual Next handler counts
        timing.board(from, true);
      }
    );
    press();
    flush();
    expect(timing.reading()).toBeNull();
    timing.board(to, false);
    flush();
    expect(timing.reading()?.readyMs).toBeNull();
    now += 730;
    timing.board(to, true);
    now += 1100; // driver checkpoints before the read
    timing.board(to, true);
    flush();
    expect(timing.reading()).toEqual({ from, to, shownMs: 100, readyMs: 830 });
  }
});

test('a board which still rejects input at one second retains the full delay', () => {
  let now = 0;
  const timing = createPuzzleReadinessTiming(() => now);
  timing.moveOn('finished');
  timing.board(null, false);
  now = 500;
  timing.board('new', false);
  now = 1001;
  timing.board('new', true);
  flush();
  expect(timing.reading()).toEqual({
    from: 'finished',
    to: 'new',
    shownMs: 500,
    readyMs: 1001,
  });
});
