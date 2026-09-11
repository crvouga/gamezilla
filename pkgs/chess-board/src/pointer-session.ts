/**
 * Pointer → {@link BoardInteraction} adapter. One primary-button press /
 * release pair is a "session": pressing one of the mover's pieces starts a
 * press; moving past {@link DRAG_THRESHOLD_PX} promotes to a drag; releasing
 * on the same square without crossing the threshold taps (select / deselect);
 * releasing elsewhere after a drag drops. Pressing anything else is a plain
 * tap that resolves on release.
 *
 * Pure: the DOM layer maps pointer coordinates to squares / pixels and calls
 * `down` / `move` / `up` / `cancel`.
 */

import type { BoardInteraction } from '@pkgs/chess-board-core/interaction';
import type { Square } from '@pkgs/chess-board-core/types';

/** Pixels of movement before a press on an owned piece becomes a drag. */
export const DRAG_THRESHOLD_PX = 4;

export type PointerSessionState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'drag';
      readonly from: Square;
      readonly wasSelected: boolean;
    }
  | {
      readonly kind: 'press';
      readonly square: Square;
      readonly wasSelected: boolean;
      readonly owns: boolean;
      readonly startX: number;
      readonly startY: number;
    };

export type PointerSessionInteraction = Pick<
  BoardInteraction,
  'getSnapshot' | 'canDrag' | 'beginDrag' | 'cancelDrag' | 'drop' | 'tap'
>;

export type PointerSession = {
  readonly state: () => PointerSessionState;
  /** Primary button pressed over `square` (null when outside the board). */
  readonly down: (
    square: Square | null,
    clientX?: number,
    clientY?: number
  ) => void;
  /**
   * Pointer moved. When a press on an owned piece exceeds the drag threshold,
   * promotes to a drag and returns true.
   */
  readonly move: (clientX: number, clientY: number) => boolean;
  /** Primary button released over `square` (null when outside the board). */
  readonly up: (square: Square | null) => void;
  /** Pointer lost (cancel / capture lost): abandon the session. */
  readonly cancel: () => void;
};

const IDLE: PointerSessionState = { kind: 'idle' };

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

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

  const promoteToDrag = (): boolean => {
    if (state.kind !== 'press' || !state.owns) return false;
    const { square, wasSelected } = state;
    if (!interaction.beginDrag(square)) {
      state = IDLE;
      return false;
    }
    state = { kind: 'drag', from: square, wasSelected };
    return true;
  };

  return {
    state: () => state,
    down(square, clientX = 0, clientY = 0) {
      if (square === null || !interaction.getSnapshot().interactive) {
        state = IDLE;
        return;
      }
      const wasSelected = interaction.getSnapshot().selected === square;
      if (interaction.canDrag(square)) {
        state = {
          kind: 'press',
          square,
          wasSelected,
          owns: true,
          startX: clientX,
          startY: clientY,
        };
        return;
      }
      state = {
        kind: 'press',
        square,
        wasSelected,
        owns: false,
        startX: clientX,
        startY: clientY,
      };
    },
    move(clientX, clientY) {
      if (state.kind !== 'press' || !state.owns) return false;
      if (
        dist(state.startX, state.startY, clientX, clientY) < DRAG_THRESHOLD_PX
      ) {
        return false;
      }
      return promoteToDrag();
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
