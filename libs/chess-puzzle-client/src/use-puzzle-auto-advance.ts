import { puzzleAutoAdvanceDelayMs } from '@libs/game-puzzle-shared/feed-config';
import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared/play-attr';
import { PUZZLE_PLAY_STATUS } from '@libs/game-puzzle-shared/play-attr';
import { useTimers } from '@pkgs/clock-client/solid';
import { type Accessor, createEffect, onCleanup } from 'solid-js';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';

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
  const [config] = useChessPuzzleFeedConfig();
  const prevRef: { current: PuzzlePlayStatus | 'loading' | null } = {
    current: null,
  };
  let pending: ReturnType<typeof timers.setTimeout> | null = null;
  const cancel = (): void => {
    if (pending === null) return;
    timers.clearTimeout(pending);
    pending = null;
  };
  onCleanup(cancel);

  createEffect(() => {
    const status = args.status();
    const prev = prevRef.current;
    prevRef.current = status;
    if (status !== PUZZLE_PLAY_STATUS.solved) {
      cancel();
      return;
    }
    if (prev !== PUZZLE_PLAY_STATUS.solving || !args.canDrive()) return;
    const delayMs = puzzleAutoAdvanceDelayMs(config().autoAdvance);
    if (delayMs === null) return;
    cancel();
    pending = timers.setTimeout(() => {
      pending = null;
      args.onNext();
    }, delayMs);
  });
}
