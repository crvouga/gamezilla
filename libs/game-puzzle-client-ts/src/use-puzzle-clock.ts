import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared-ts/play-attr';
import {
  isPuzzleClockRunning,
  puzzleElapsedMs,
} from '@libs/game-puzzle-shared-ts/puzzle-clock';
import { useClock, useTimers } from '@pkgs/clock-client-ts/solid';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';

const TICK_MS = 250;

/**
 * Synced stopwatch for the live attempt. The anchors come from the room's
 * server-stamped times; only the tick reads the injected client clock, so
 * every viewer shows (nearly) the same number and the harness shows the same one
 * exactly.
 */
export function usePuzzleClock(args: {
  readonly status: Accessor<PuzzlePlayStatus | 'loading'>;
  readonly startedAtMs: Accessor<number | null>;
  readonly endedAtMs: Accessor<number | null>;
}): {
  elapsedMs: Accessor<number | null>;
  running: Accessor<boolean>;
} {
  const clock = useClock();
  const timers = useTimers();
  const running = createMemo(
    () =>
      isPuzzleClockRunning(args.status()) &&
      args.startedAtMs() !== null &&
      args.endedAtMs() === null
  );
  // The clock is read again whenever the stopwatch starts or stops.
  const [nowMs, setNowMs] = createSignal((): number => {
    running();
    return clock.now();
  });
  createEffect(running, (ticking) => {
    if (!ticking) return;
    const handle = timers.setInterval(() => setNowMs(clock.now()), TICK_MS);
    return () => timers.clearInterval(handle);
  });
  return {
    elapsedMs: createMemo(() =>
      puzzleElapsedMs({
        startedAtMs: args.startedAtMs(),
        endedAtMs: args.endedAtMs(),
        nowMs: nowMs(),
      })
    ),
    running,
  };
}
