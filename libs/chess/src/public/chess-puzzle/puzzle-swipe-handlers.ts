import {
  type PuzzleNavIntent,
  puzzleNavIntentFromSwipe,
} from '../../shared/puzzle-session/puzzle-nav';

export type PuzzleSwipeHandlers = {
  readonly onPointerDown: (event: PointerEvent) => void;
  readonly onPointerUp: (event: PointerEvent) => void;
  readonly onPointerCancel: () => void;
};

type Origin = { x: number; y: number } | null;

/**
 * Thin DOM adapter over {@link puzzleNavIntentFromSwipe}: remember where the
 * press started, classify the travel on release. The decision itself stays in
 * the pure kernel, and a press that does not travel far enough is left alone
 * so taps still reach the elements underneath.
 */
export function puzzleSwipeHandlers(
  onNavigate: (intent: PuzzleNavIntent) => void
): PuzzleSwipeHandlers {
  const origin: { current: Origin } = { current: null };
  return {
    onPointerDown(event) {
      origin.current = { x: event.clientX, y: event.clientY };
    },
    onPointerUp(event) {
      const from = origin.current;
      origin.current = null;
      if (from === null) return;
      const intent = puzzleNavIntentFromSwipe({
        dx: event.clientX - from.x,
        dy: event.clientY - from.y,
      });
      if (intent !== null) onNavigate(intent);
    },
    onPointerCancel() {
      origin.current = null;
    },
  };
}
