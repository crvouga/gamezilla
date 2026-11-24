/**
 * Keyboard play: arrow keys walk the cursor (roving focus across the hit
 * grid, in screen space whatever the orientation), Enter / Space pick up and
 * drop like a tap, Escape cancels a drag, the selection, an open promotion
 * and every premove.
 */

import { isSquare } from '@pkgs/chess-board-core-shared-ts/geometry';
import type {
  BoardOrientation,
  Square,
} from '@pkgs/chess-board-core-shared-ts/types';
import {
  isArrowKey,
  moveCursor,
} from '@pkgs/chess-board-root-shared-ts/keyboard-nav';
import type { PointerSession } from '@pkgs/chess-board-root-shared-ts/pointer-session';
import type { Accessor } from 'solid-js';

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

/**
 * The square a key acts on: the one holding focus when the key is pressed.
 * A key can follow the focus that moved there before the cursor has caught
 * up with it, so the pressed square is read from the event; the cursor
 * answers only for a key pressed on the board itself.
 */
function keySquare(event: KeyboardEvent, cursor: Square): Square {
  const target = event.target;
  if (!(target instanceof Element)) return cursor;
  const square = target
    .closest<HTMLElement>('[data-square]')
    ?.getAttribute('data-square');
  return typeof square === 'string' && isSquare(square) ? square : cursor;
}

export function createBoardKeyHandler(
  args: BoardKeysArgs
): (event: KeyboardEvent) => void {
  return (event) => {
    // regression: board-key-in-the-same-turn-as-focus
    const at = keySquare(event, args.cursor());
    if (isArrowKey(event.key)) {
      event.preventDefault();
      const next = moveCursor(at, event.key, args.orientation());
      if (next === null) return;
      args.setCursor(next);
      focusSquare(args.host(), next);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      args.clearAnnotations();
      args.session.down(at);
      args.session.up(at);
      return;
    }
    if (event.key === 'Escape') {
      args.cancel();
    }
  };
}
