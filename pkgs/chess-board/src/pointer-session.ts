/**
 * Pointer → {@link BoardInteraction} adapter. One primary-button press /
 * release pair is a "session": pressing one of the mover's pieces starts a
 * drag; releasing on the same square degrades to a tap (select / deselect);
 * releasing elsewhere drops. Pressing anything else is a plain tap that
 * resolves on release (so a stray drag off an empty square does nothing).
 *
 * Pure: the DOM layer maps pointer coordinates to squares and calls
 * `down` / `up` / `cancel`.
 */

import type { BoardInteraction } from '@pkgs/chess-board-core/interaction';
import type { Square } from '@pkgs/chess-board-core/types';

export type PointerSessionState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'drag';
      readonly from: Square;
      readonly wasSelected: boolean;
    }
  | { readonly kind: 'press'; readonly square: Square };

export type PointerSessionInteraction = Pick<
  BoardInteraction,
  'getSnapshot' | 'beginDrag' | 'cancelDrag' | 'drop' | 'tap'
>;

export type PointerSession = {
  readonly state: () => PointerSessionState;
  /** Primary button pressed over `square` (null when outside the board). */
  readonly down: (square: Square | null) => void;
  /** Primary button released over `square` (null when outside the board). */
  readonly up: (square: Square | null) => void;
  /** Pointer lost (cancel / capture lost): abandon the session. */
  readonly cancel: () => void;
};

const IDLE: PointerSessionState = { kind: 'idle' };

export function createPointerSession(
  interaction: PointerSessionInteraction
): PointerSession {
  let state: PointerSessionState = IDLE;

  const finishDrag = (
    from: Square,
    wasSelected: boolean,
    to: Square | null
  ) => {
    if (to === null || to === from) {
      interaction.cancelDrag();
      // Tapping the already-selected piece deselects (the drag start cleared
      // the selection, so only re-select when it was not selected before).
      if (!wasSelected) interaction.tap(from);
      return;
    }
    interaction.drop(from, to);
  };

  return {
    state: () => state,
    down(square) {
      if (square === null || !interaction.getSnapshot().interactive) {
        state = IDLE;
        return;
      }
      const wasSelected = interaction.getSnapshot().selected === square;
      state = interaction.beginDrag(square)
        ? { kind: 'drag', from: square, wasSelected }
        : { kind: 'press', square };
    },
    up(square) {
      const current = state;
      state = IDLE;
      if (current.kind === 'drag') {
        finishDrag(current.from, current.wasSelected, square);
        return;
      }
      if (current.kind === 'press' && square === current.square) {
        interaction.tap(square);
      }
    },
    cancel() {
      if (state.kind === 'drag') interaction.cancelDrag();
      state = IDLE;
    },
  };
}
