/**
 * Pointer → {@link BoardInteraction} adapter. One primary-button press /
 * release pair is a "session":
 *
 * - Pressing a piece the person may move picks it up *at once* (a drag from
 *   the first event — the piece jumps under the pointer on `pointerdown`,
 *   not after the first move).
 * - Until the pointer travels past the pointer-type threshold, the release
 *   still counts as a tap on the pressed square (select / deselect): finger
 *   jitter across a square edge never drops a piece on a neighbour.
 * - Pressing anything else is a plain tap that resolves on release.
 *
 * Pure: the DOM layer maps pointer coordinates to squares / pixels and calls
 * `down` / `move` / `up` / `cancel`.
 */

import type { BoardInteraction } from '@pkgs/chess-board-core-shared/interaction';
import type { Square } from '@pkgs/chess-board-core-shared/types';

/** Mouse / pen: pixels of travel before a release counts as a drop. */
export const MOUSE_DRAG_THRESHOLD_PX = 4;
/** Touch: larger, fingers wobble. */
export const TOUCH_DRAG_THRESHOLD_PX = 8;

export type PointerSessionState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'drag';
      readonly from: Square;
      readonly wasSelected: boolean;
      /** Travelled past the threshold: a release is a drop. */
      readonly moved: boolean;
      readonly startX: number;
      readonly startY: number;
      readonly threshold: number;
    }
  | {
      readonly kind: 'press';
      readonly square: Square;
    };

export type PointerSessionInteraction = Pick<
  BoardInteraction,
  'getSnapshot' | 'canDrag' | 'beginDrag' | 'cancelDrag' | 'drop' | 'tap'
>;

export type PointerSession = {
  readonly state: () => PointerSessionState;
  /**
   * Primary button pressed over `square` (null when outside the board).
   * Picks the piece up when it may move.
   */
  readonly down: (
    square: Square | null,
    clientX?: number,
    clientY?: number,
    pointerType?: string
  ) => void;
  /** Pointer moved. Returns true the first time a drag passes its threshold. */
  readonly move: (clientX: number, clientY: number) => boolean;
  /** Primary button released over `square` (null when outside the board). */
  readonly up: (square: Square | null) => void;
  /** Pointer lost (cancel / capture lost): abandon the session. */
  readonly cancel: () => void;
};

const IDLE: PointerSessionState = { kind: 'idle' };

function thresholdForPointer(pointerType: string | undefined): number {
  return pointerType === 'touch'
    ? TOUCH_DRAG_THRESHOLD_PX
    : MOUSE_DRAG_THRESHOLD_PX;
}

function finishDrag(
  interaction: PointerSessionInteraction,
  drag: Extract<PointerSessionState, { readonly kind: 'drag' }>,
  to: Square | null
): void {
  const { from, wasSelected, moved } = drag;
  if (to === null || to === from) {
    interaction.cancelDrag();
    // Tapping the already-selected piece deselects (the pick-up cleared the
    // selection, so only re-select when it was not selected before).
    if (!moved && !wasSelected) interaction.tap(from);
    return;
  }
  interaction.drop(from, to);
}

export function createPointerSession(
  interaction: PointerSessionInteraction
): PointerSession {
  let state: PointerSessionState = IDLE;

  return {
    state: () => state,
    down(square, clientX = 0, clientY = 0, pointerType) {
      if (square === null || !interaction.getSnapshot().interactive) {
        state = IDLE;
        return;
      }
      const wasSelected = interaction.getSnapshot().selected === square;
      if (interaction.canDrag(square) && interaction.beginDrag(square)) {
        state = {
          kind: 'drag',
          from: square,
          wasSelected,
          moved: false,
          startX: clientX,
          startY: clientY,
          threshold: thresholdForPointer(pointerType),
        };
        return;
      }
      state = { kind: 'press', square };
    },
    move(clientX, clientY) {
      if (state.kind !== 'drag' || state.moved) return false;
      const travel = Math.hypot(clientX - state.startX, clientY - state.startY);
      if (travel < state.threshold) return false;
      state = { ...state, moved: true };
      return true;
    },
    up(square) {
      const current = state;
      state = IDLE;
      if (current.kind === 'drag') {
        const to = current.moved ? square : current.from;
        finishDrag(interaction, current, to);
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
