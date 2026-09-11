/**
 * Pointer → {@link BoardInteraction} adapter. One primary-button press /
 * release pair is a "session": pressing one of the mover's pieces starts a
 * press; moving past the pointer-type drag threshold promotes to a drag;
 * releasing on the same square without crossing the threshold taps (select /
 * deselect); releasing elsewhere after a drag drops. Pressing anything else
 * is a plain tap that resolves on release.
 *
 * Pure: the DOM layer maps pointer coordinates to squares / pixels and calls
 * `down` / `move` / `up` / `cancel`.
 */

import type { BoardInteraction } from '@pkgs/chess-board-core/interaction';
import type { Square } from '@pkgs/chess-board-core/types';

/** Mouse / pen: pixels of movement before an owned press becomes a drag. */
export const MOUSE_DRAG_THRESHOLD_PX = 4;
/** Touch: larger threshold to avoid accidental drags. */
export const TOUCH_DRAG_THRESHOLD_PX = 8;

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
      readonly threshold: number;
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
    clientY?: number,
    pointerType?: string
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

function thresholdForPointer(pointerType: string | undefined): number {
  return pointerType === 'touch'
    ? TOUCH_DRAG_THRESHOLD_PX
    : MOUSE_DRAG_THRESHOLD_PX;
}

function finishDrag(
  interaction: PointerSessionInteraction,
  from: Square,
  wasSelected: boolean,
  to: Square | null
): void {
  if (to === null || to === from) {
    interaction.cancelDrag();
    // Tapping the already-selected piece deselects (the drag start cleared
    // the selection, so only re-select when it was not selected before).
    if (!wasSelected) interaction.tap(from);
    return;
  }
  interaction.drop(from, to);
}

export function createPointerSession(
  interaction: PointerSessionInteraction
): PointerSession {
  let state: PointerSessionState = IDLE;

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

  const downPress = (
    square: Square,
    clientX: number,
    clientY: number,
    pointerType: string | undefined
  ): void => {
    const wasSelected = interaction.getSnapshot().selected === square;
    const threshold = thresholdForPointer(pointerType);
    const owns = interaction.canDrag(square);
    state = {
      kind: 'press',
      square,
      wasSelected,
      owns,
      startX: clientX,
      startY: clientY,
      threshold,
    };
  };

  return {
    state: () => state,
    down(square, clientX = 0, clientY = 0, pointerType) {
      if (square === null || !interaction.getSnapshot().interactive) {
        state = IDLE;
        return;
      }
      downPress(square, clientX, clientY, pointerType);
    },
    move(clientX, clientY) {
      if (state.kind !== 'press' || !state.owns) return false;
      if (dist(state.startX, state.startY, clientX, clientY) < state.threshold) {
        return false;
      }
      return promoteToDrag();
    },
    up(square) {
      const current = state;
      state = IDLE;
      if (current.kind === 'drag') {
        finishDrag(interaction, current.from, current.wasSelected, square);
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
