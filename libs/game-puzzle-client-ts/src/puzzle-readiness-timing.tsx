import { useClock } from '@pkgs/clock-client-ts/solid';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import type { JSX } from '@solidjs/web';
import { createEffect, createSignal, onCleanup } from 'solid-js';
import { PUZZLE_TEST_ENABLED } from './puzzle-test-enabled';

export const PUZZLE_READINESS_PROBE = 'puzzle-readiness-timing';

type PuzzleReadinessReading = {
  readonly from: string;
  readonly to: string;
  readonly shownMs: number;
  readonly readyMs: number | null;
};

/** Next and the board share the device clock, including during a player remount. */
export function createPuzzleReadinessTiming(now: () => number) {
  let request: { from: string; at: number } | undefined;
  const [reading, setReading] = createSignal<PuzzleReadinessReading | null>(
    null
  );
  return {
    reading,
    moveOn(from: string) {
      request = { from, at: now() };
      setReading(null);
    },
    board(id: string | null, interactive: boolean) {
      if (request === undefined) return;
      if (id === null || id === request.from) {
        setReading(null);
        return;
      }
      const elapsed = now() - request.at;
      const from = request.from;
      setReading((last) => {
        const previous = last?.to === id && last.from === from ? last : null;
        return {
          from,
          to: id,
          shownMs: previous?.shownMs ?? elapsed,
          readyMs: interactive ? (previous?.readyMs ?? elapsed) : null,
        };
      });
    },
  };
}

export type PuzzleReadinessTiming = ReturnType<
  typeof createPuzzleReadinessTiming
>;

export function usePuzzleTestTiming(): PuzzleReadinessTiming | undefined {
  return PUZZLE_TEST_ENABLED
    ? createPuzzleReadinessTiming(useClock().now)
    : undefined;
}

export function timeNextPuzzle(
  timing: PuzzleReadinessTiming | undefined,
  puzzleId: () => string,
  next: () => void
): () => void {
  if (!timing) return next;
  return () => {
    timing.moveOn(puzzleId());
    next();
  };
}

/** Observe a rendered board only while it has a position and is open for play. */
export function observePuzzleBoard(
  timing: PuzzleReadinessTiming | undefined,
  board: () => { id: string | null; interactive: boolean }
): void {
  if (!timing) return;
  createEffect(board, ({ id, interactive }) => timing.board(id, interactive));
  onCleanup(() => timing.board(null, false));
}

export function PuzzleReadinessProbe(props: {
  timing: PuzzleReadinessTiming | undefined;
}): JSX.Element {
  return (
    props.timing && (
      <VisuallyHidden testId={PUZZLE_READINESS_PROBE}>
        {JSON.stringify(props.timing.reading())}
      </VisuallyHidden>
    )
  );
}
