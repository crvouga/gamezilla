import { useClock, useTimers } from '@pkgs/clock-client/solid';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from 'solid-js';

import {
  isPuzzleClockRunning,
  puzzleElapsedMs,
} from '@libs/chess-puzzle-shared/puzzle-clock';
import type { ChessPuzzlePlayStatus } from '@libs/chess-puzzle-shared/chess-puzzle-play-attr';

const TICK_MS = 250;

/**
 * Synced stopwatch for the live attempt. The anchors come from the room's
 * server-stamped times; only the tick reads the injected client clock, so
 * every viewer shows (nearly) the same number and the harness shows the same one
 * exactly.
 */
export function usePuzzleClock(args: {
  readonly status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  readonly startedAtMs: Accessor<number | null>;
  readonly endedAtMs: Accessor<number | null>;
}): {
  elapsedMs: Accessor<number | null>;
  running: Accessor<boolean>;
} {
  const clock = useClock();
  const timers = useTimers();
  const [nowMs, setNowMs] = createSignal(clock.now());
  const running = createMemo(
    () =>
      isPuzzleClockRunning(args.status()) &&
      args.startedAtMs() !== null &&
      args.endedAtMs() === null
  );
  createEffect(() => {
    setNowMs(clock.now());
    if (!running()) return;
    const handle = timers.setInterval(() => setNowMs(clock.now()), TICK_MS);
    onCleanup(() => timers.clearInterval(handle));
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
