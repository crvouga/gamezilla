/**
 * Pointer input for the board host, as native listeners:
 *
 * - Idle, the board listens for `pointerdown` / `contextmenu` only — hovering
 *   runs no script at all (cursors come from CSS).
 * - A press adds `pointermove` / `pointerup` / `pointercancel` /
 *   `lostpointercapture` for its own pointer id and removes them on release;
 *   a second finger or button is ignored.
 * - A left press drives {@link PointerSession}. A movable piece is picked up
 *   on the press itself — it jumps under the pointer before any movement —
 *   and then follows it through a top-layer avatar ({@link PieceDrag}), one
 *   style write per event. A touch long-press's `contextmenu` never cancels
 *   the drag.
 * - A right press draws shapes (live preview, snapping to squares) and, like
 *   chess.com, first cancels the selection and every premove. A right button
 *   pressed during a left drag cancels the drag (the piece springs back).
 */

import type { BoardInteraction } from '@pkgs/chess-board-core/interaction';
import type { BoardOrientation, Square } from '@pkgs/chess-board-core/types';
import { type Accessor, batch } from 'solid-js';
import {
  type BoardBox,
  createBoardBoxCache,
  squareAt,
  toBoardPoint,
} from './board-box';
import { type MotionPolicy, settleDurationMs } from './board-motion';
import type { Haptics } from './chess-board-haptics';
import { brushFromModifiers, type UserShapes } from './chess-board-user-shapes';
import type { PieceAnimator } from './piece-animator';
import type { HoverSquare, PieceDrag } from './piece-drag';
import type { PointerSession } from './pointer-session';

export type BoardPointerArgs = {
  readonly boardPx: Accessor<number>;
  readonly orientation: Accessor<BoardOrientation>;
  readonly enableUserArrows: Accessor<boolean>;
  readonly session: PointerSession;
  readonly actions: BoardInteraction;
  readonly userShapes: UserShapes;
  readonly setCursor: (square: Square) => void;
  readonly drag: PieceDrag;
  readonly hover: HoverSquare;
  readonly animator: PieceAnimator;
  readonly motion: Accessor<MotionPolicy>;
  readonly haptics: Haptics;
  /** Host class while a piece is dragged (grabbing cursor). */
  readonly dragActiveClass: string;
  /** The last press was a finger (haptics follow touch only). */
  readonly setTouch: (touch: boolean) => void;
};

type Press = {
  readonly pointerId: number;
  readonly button: 'primary' | 'secondary';
  readonly touch: boolean;
};

function pieceElementAt(host: HTMLElement, square: Square): HTMLElement | null {
  return host.querySelector<HTMLElement>(`[data-piece-square="${square}"]`);
}

function capture(host: HTMLElement, pointerId: number): void {
  try {
    host.setPointerCapture(pointerId);
  } catch {
    // Synthetic / already-released pointers cannot be captured; the press
    // still works through the host listeners.
  }
}

/** Board pointer input; {@link attach} it to the host element. */
export class BoardPointer {
  private readonly boxes = createBoardBoxCache();
  private host: HTMLElement | null = null;
  private press: Press | null = null;

  constructor(private readonly args: BoardPointerArgs) {}

  /** Install on the host; returns the uninstaller. */
  attach(node: HTMLElement): () => void {
    this.host = node;
    node.addEventListener('pointerdown', this.onDown);
    node.addEventListener('contextmenu', this.onContextMenu);
    return () => {
      this.cancelPress();
      node.removeEventListener('pointerdown', this.onDown);
      node.removeEventListener('contextmenu', this.onContextMenu);
      this.host = null;
    };
  }

  /** Abandon the press in progress (Escape): a dragged piece springs back. */
  cancelPress(): void {
    const press = this.press;
    if (press === null) return;
    const box = this.box();
    this.endPress();
    if (press.button === 'secondary') {
      this.args.userShapes.abort();
      return;
    }
    const moved = this.dragMoved();
    batch(() => this.args.session.cancel());
    this.releaseDrag(moved, box);
  }

  /** The current drag travelled past its threshold (a real drag, not a tap). */
  private dragMoved(): boolean {
    const st = this.args.session.state();
    return st.kind === 'drag' && st.moved;
  }

  private box(): BoardBox {
    if (this.host === null) return { left: 0, top: 0, size: 0 };
    return this.boxes.get(this.host, this.args.boardPx());
  }

  private squareOf(e: PointerEvent): Square | null {
    const b = this.box();
    return squareAt(b, toBoardPoint(b, e), this.args.orientation());
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (this.press !== null || this.host === null) return;
    if (e.button !== 0 && e.button !== 2) return;
    // The board handles the press itself: no compatibility mouse events
    // after a touch (less work on slow phones), no text selection, no
    // browser focus churn.
    e.preventDefault();
    if (e.button === 2) this.downSecondary(e);
    else this.downPrimary(e);
  };

  /**
   * A mouse / pen press keeps keyboard play working afterwards (the default
   * focus-on-press is prevented); a finger has no keyboard to hand over to.
   */
  private focusSquare(square: Square, touch: boolean): void {
    if (touch || this.host === null) return;
    const button = this.host.querySelector<HTMLElement>(
      `[data-square="${square}"]`
    );
    if (button !== null && button.ownerDocument.activeElement !== button) {
      button.focus({ preventScroll: true });
    }
  }

  private downPrimary(e: PointerEvent): void {
    const touch = e.pointerType === 'touch';
    this.args.setTouch(touch);
    if (this.args.enableUserArrows()) this.args.userShapes.clear();
    this.startPress(e, { pointerId: e.pointerId, button: 'primary', touch });
    const square = this.squareOf(e);
    // One reactive flush: a pick-up publishes the interaction state more
    // than once (drag, selection, targets). Safe to batch — a press never
    // plays a move, so the parent's `onMove` cannot run inside the batch.
    batch(() =>
      this.args.session.down(square, e.clientX, e.clientY, e.pointerType)
    );
    if (square !== null) {
      this.args.setCursor(square);
      this.focusSquare(square, touch);
    }
    // A movable piece is picked up now, not on the first move: it jumps
    // under the pointer (above the finger on touch) in the press's frame.
    if (this.args.session.state().kind === 'drag') {
      this.beginDrag(e, touch);
      this.followDrag(e);
    }
  }

  private downSecondary(e: PointerEvent): void {
    batch(() => this.args.actions.cancelAll());
    if (!this.args.enableUserArrows()) return;
    const square = this.squareOf(e);
    if (square === null) return;
    const touch = e.pointerType === 'touch';
    this.startPress(e, { pointerId: e.pointerId, button: 'secondary', touch });
    this.args.userShapes.begin(
      square,
      brushFromModifiers(e.shiftKey, e.altKey, e.ctrlKey || e.metaKey)
    );
  }

  private startPress(e: PointerEvent, press: Press): void {
    const host = this.host;
    if (host === null) return;
    this.press = press;
    capture(host, e.pointerId);
    host.addEventListener('pointermove', this.onMove);
    host.addEventListener('pointerup', this.onUp);
    host.addEventListener('pointercancel', this.onLost);
    host.addEventListener('lostpointercapture', this.onLost);
    host.ownerDocument.defaultView?.addEventListener('blur', this.onBlur);
  }

  private endPress(): void {
    const pointerId = this.press?.pointerId;
    this.press = null;
    this.boxes.clear();
    const host = this.host;
    if (host === null) return;
    host.removeEventListener('pointermove', this.onMove);
    host.removeEventListener('pointerup', this.onUp);
    host.removeEventListener('pointercancel', this.onLost);
    host.removeEventListener('lostpointercapture', this.onLost);
    host.ownerDocument.defaultView?.removeEventListener('blur', this.onBlur);
    if (pointerId !== undefined) {
      try {
        host.releasePointerCapture(pointerId);
      } catch {
        /* Already lost. */
      }
    }
  }

  private readonly onMove = (e: PointerEvent): void => {
    const press = this.press;
    if (press === null || e.pointerId !== press.pointerId) return;
    if (press.button === 'secondary') {
      this.args.userShapes.hover(this.squareOf(e));
      return;
    }
    // A right button chorded into a left press: put the piece back.
    if ((e.buttons & 2) !== 0) {
      this.cancelPress();
      return;
    }
    if (this.args.session.state().kind !== 'drag') return;
    this.args.session.move(e.clientX, e.clientY);
    this.followDrag(e);
  };

  private readonly onUp = (e: PointerEvent): void => {
    const press = this.press;
    if (press === null || e.pointerId !== press.pointerId) return;
    const box = this.box();
    const square = squareAt(box, toBoardPoint(box, e), this.args.orientation());
    this.endPress();
    if (press.button === 'secondary') {
      this.args.userShapes.end(square);
      return;
    }
    const moved = this.dragMoved();
    const st = this.args.session.state();
    if (st.kind === 'drag' && !moved) {
      // A tap on the piece itself (deselect / select): no move can result,
      // so one flush. A release that may play a move is never batched — the
      // parent's `onMove` must run with its own effects, not inside ours.
      batch(() => this.args.session.up(square));
    } else {
      this.args.session.up(square);
    }
    this.releaseDrag(moved, box);
  };

  private readonly onLost = (e: PointerEvent): void => {
    if (this.press === null || e.pointerId !== this.press.pointerId) return;
    this.cancelPress();
  };

  private readonly onBlur = (): void => this.cancelPress();

  private readonly onContextMenu = (e: MouseEvent): void => {
    // The board owns the right button (shapes / cancel), never the menu.
    e.preventDefault();
    // A right button during a mouse / pen drag puts the piece back. On
    // touch, `contextmenu` is a long-press (Android): holding a piece still
    // must not drop it.
    const press = this.press;
    if (press?.button === 'primary' && !press.touch) this.cancelPress();
  };

  private beginDrag(e: PointerEvent, touch: boolean): void {
    const st = this.args.session.state();
    const host = this.host;
    if (st.kind !== 'drag' || host === null) return;
    const el = pieceElementAt(host, st.from);
    if (el === null) return;
    const b = this.box();
    this.args.animator.grab(el);
    this.args.drag.begin({
      element: el,
      clientX: e.clientX,
      clientY: e.clientY,
      cellPx: b.size / 8,
      touch,
    });
    this.args.hover.setTouch(touch);
    host.classList.add(this.args.dragActiveClass);
    if (touch) this.args.haptics.light();
  }

  /** Hot path: two numbers in, one style write out, nothing allocated. */
  private followDrag(e: PointerEvent): void {
    this.args.drag.move(e.clientX, e.clientY);
    const b = this.box();
    const x = e.clientX - b.left;
    const y = e.clientY - b.top;
    if (x < 0 || y < 0 || x >= b.size || y >= b.size) {
      this.args.hover.hide();
      return;
    }
    const cell = b.size / 8;
    this.args.hover.show(Math.floor(x / cell), Math.floor(y / cell));
  }

  /**
   * Hand the piece back from its avatar. A real drag settles (onto the new
   * square, or back to its own); a tap — picked up but never moved — snaps
   * home at once, as on chess.com.
   */
  private releaseDrag(moved: boolean, box: BoardBox): void {
    const el = this.args.drag.end(box);
    this.args.hover.hide();
    this.host?.classList.remove(this.args.dragActiveClass);
    if (el === null) return;
    const policy = this.args.motion();
    this.args.animator.release(el, {
      slide: policy.slides && moved,
      durationMs: settleDurationMs(policy.durationMs),
    });
  }
}
