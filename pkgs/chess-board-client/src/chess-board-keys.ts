/**
 * Keyboard play: arrow keys walk the cursor (roving focus across the hit
 * grid, in screen space whatever the orientation), Enter / Space pick up and
 * drop like a tap, Escape cancels a drag, the selection, an open promotion
 * and every premove.
 */

import type { BoardOrientation, Square } from '@pkgs/chess-board-core-shared/types';
import { type Accessor, batch } from 'solid-js';

import { isArrowKey, moveCursor } from '@pkgs/chess-board-shared/keyboard-nav';
import type { PointerSession } from '@pkgs/chess-board-shared/pointer-session';

export type BoardKeysArgs = {
  readonly host: Accessor<HTMLElement | undefined>;
  readonly orientation: Accessor<BoardOrientation>;
  readonly session: PointerSession;
  readonly cursor: Accessor<Square>;
  readonly setCursor: (square: Square) => void;
  readonly clearAnnotations: () => void;
  /** Escape: abandon the press / selection / premoves. */
  readonly cancel: () => void;
};

/** Roving focus: the cursor square's button holds keyboard focus. */
function focusSquare(host: HTMLElement | undefined, square: Square): void {
  host?.querySelector<HTMLElement>(`[data-square="${square}"]`)?.focus();
}

export function createBoardKeyHandler(
  args: BoardKeysArgs
): (event: KeyboardEvent) => void {
  return (event) => {
    if (isArrowKey(event.key)) {
      event.preventDefault();
      const next = moveCursor(args.cursor(), event.key, args.orientation());
      if (next === null) return;
      args.setCursor(next);
      focusSquare(args.host(), next);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      args.clearAnnotations();
      // Not batched: Enter on a target plays a move, and the parent's
      // `onMove` must run with its own effects, not inside a board batch.
      args.session.down(args.cursor());
      args.session.up(args.cursor());
      return;
    }
    if (event.key === 'Escape') {
      batch(args.cancel);
    }
  };
}
