import { puzzleAutoAdvanceDelayMs } from '@libs/game-puzzle-shared-ts/feed-config';
import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared-ts/play-attr';
import { PUZZLE_PLAY_STATUS } from '@libs/game-puzzle-shared-ts/play-attr';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { type Accessor, createEffect, onCleanup } from 'solid-js';
import { usePuzzleFeedConfig } from './use-puzzle-feed-config';

/**
 * §5 auto-advance: after a live solve (solving → solved, never a restored
 * or re-scrubbed solve), move to the next puzzle after the configured delay
 * (injected timers). Off by default; failures never auto-advance.
 */
export function usePuzzleAutoAdvance(args: {
  status: Accessor<PuzzlePlayStatus | 'loading'>;
  canDrive: Accessor<boolean>;
  onNext: () => void;
}): void {
  const timers = useTimers();
  const [config] = usePuzzleFeedConfig();
  let pending: ReturnType<typeof timers.setTimeout> | null = null;
  const cancel = (): void => {
    if (pending === null) return;
    timers.clearTimeout(pending);
    pending = null;
  };
  onCleanup(cancel);

  createEffect(
    () => ({
      status: args.status(),
      canDrive: args.canDrive(),
      delayMs: puzzleAutoAdvanceDelayMs(config().autoAdvance),
    }),
    (now, before) => {
      if (now.status !== PUZZLE_PLAY_STATUS.solved) {
        cancel();
        return;
      }
      if (before?.status !== PUZZLE_PLAY_STATUS.solving || !now.canDrive)
        return;
      if (now.delayMs === null) return;
      cancel();
      pending = timers.setTimeout(() => {
        pending = null;
        args.onNext();
      }, now.delayMs);
    }
  );
}
