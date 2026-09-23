import { useClock, useTimers } from '@pkgs/clock/solid';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from 'solid-js';

import {
  nextPuzzleClockAnchor,
  type PuzzleClockAnchor,
  puzzleElapsedMs,
} from '../../shared/puzzle-session/puzzle-clock';
import type { SolveStatus } from '../../shared/puzzle-session/solve-status';

const TICK_MS = 250;

/**
 * Stopwatch for the puzzle on screen. The anchor lives with this view: it
 * starts when the attempt is solving, keeps running through a wrong move,
 * and freezes once the puzzle is solved or invalid.
 */
export function usePuzzleClock(args: {
  readonly puzzleId: Accessor<string>;
  readonly layoutKey: Accessor<number>;
  readonly status: Accessor<SolveStatus>;
}): { readonly elapsedMs: Accessor<number | null> } {
  const clock = useClock();
  const timers = useTimers();
  const [nowMs, setNowMs] = createSignal(clock.now());
  const [anchor, setAnchor] = createSignal<PuzzleClockAnchor | null>(null);

  createEffect(() => {
    const next = nextPuzzleClockAnchor({
      previous: anchor(),
      puzzleId: args.puzzleId(),
      layoutKey: args.layoutKey(),
      status: args.status(),
      nowMs: clock.now(),
    });
    if (next !== anchor()) setAnchor(next);
  });

  const running = createMemo(() => {
    const current = anchor();
    return current !== null && current.endedAtMs === null;
  });

  createEffect(() => {
    setNowMs(clock.now());
    if (!running()) return;
    const handle = timers.setInterval(() => {
      setNowMs(clock.now());
    }, TICK_MS);
    onCleanup(() => {
      timers.clearInterval(handle);
    });
  });

  return {
    elapsedMs: createMemo(() => {
      const current = anchor();
      if (current === null) return null;
      return puzzleElapsedMs({
        startedAtMs: current.startedAtMs,
        endedAtMs: current.endedAtMs,
        nowMs: nowMs(),
      });
    }),
  };
}
