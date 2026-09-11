/**
 * Pointer / keyboard handlers for the chess board host.
 */

import { xyToSquare } from '@pkgs/chess-board-core/geometry';
import type { BoardOrientation, Square } from '@pkgs/chess-board-core/types';
import type { Accessor, Setter } from 'solid-js';

import { pxToUnits } from './board-units';
import type { UserArrows } from './chess-board-user-arrows';
import type { ChessBoardModel } from './create-chess-board-model';
import { isArrowKey, moveCursor } from './keyboard-nav';
import type { PointerSession } from './pointer-session';

function squareFromRect(args: {
  event: { clientX: number; clientY: number };
  rect: DOMRect;
  boardPx: number;
  orientation: BoardOrientation;
}): Square | null {
  return xyToSquare(
    args.event.clientX - args.rect.left,
    args.event.clientY - args.rect.top,
    args.boardPx,
    args.orientation
  );
}

export type BoardHandlers = {
  readonly onPointerDown: (event: PointerEvent) => void;
  readonly onPointerMove: (event: PointerEvent) => void;
  readonly onPointerUp: (event: PointerEvent) => void;
  readonly onPointerCancel: () => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
  readonly onContextMenu: (event: MouseEvent) => void;
};

type HandlerArgs = {
  readonly host: Accessor<HTMLElement | undefined>;
  readonly boardPx: Accessor<number>;
  readonly orientation: Accessor<BoardOrientation>;
  readonly enableUserArrows: Accessor<boolean>;
  readonly session: PointerSession;
  readonly model: ChessBoardModel;
  readonly userArrows: UserArrows;
  readonly cursor: Accessor<Square>;
  readonly setCursor: Setter<Square>;
  readonly setDragAt: Setter<{ x: number; y: number } | null>;
};

function createPointerPart(
  args: HandlerArgs
): Pick<
  BoardHandlers,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
> {
  let cachedRect: DOMRect | null = null;
  let rectRo: ResizeObserver | null = null;

  const clearRectCache = (): void => {
    cachedRect = null;
    if (rectRo !== null) {
      rectRo.disconnect();
      rectRo = null;
    }
  };

  const ensureRect = (node: HTMLElement): DOMRect => {
    if (cachedRect !== null) return cachedRect;
    cachedRect = node.getBoundingClientRect();
    rectRo = new ResizeObserver(() => {
      cachedRect = node.getBoundingClientRect();
    });
    rectRo.observe(node);
    return cachedRect;
  };

  const at = (event: { clientX: number; clientY: number }): Square | null => {
    const node = args.host();
    if (node === undefined) return null;
    return squareFromRect({
      event,
      rect: ensureRect(node),
      boardPx: args.boardPx(),
      orientation: args.orientation(),
    });
  };

  const setDragUnits = (event: { clientX: number; clientY: number }): void => {
    const node = args.host();
    if (node === undefined) return;
    const rect = ensureRect(node);
    const px = args.boardPx();
    args.setDragAt({
      x: pxToUnits(event.clientX - rect.left, px),
      y: pxToUnits(event.clientY - rect.top, px),
    });
  };

  return {
    onPointerDown(event) {
      const node = args.host();
      if (node === undefined || event.button !== 0) return;
      if (args.enableUserArrows()) args.userArrows.clear();
      node.setPointerCapture(event.pointerId);
      clearRectCache();
      ensureRect(node);
      const sq = at(event);
      args.session.down(sq, event.clientX, event.clientY);
      if (sq !== null) args.setCursor(sq);
    },
    onPointerMove(event) {
      const before = args.session.state().kind;
      const promoted = args.session.move(event.clientX, event.clientY);
      const kind = args.session.state().kind;
      if (kind !== 'drag') return;
      if (promoted || before === 'drag') setDragUnits(event);
    },
    onPointerUp(event) {
      if (event.button === 2 && args.enableUserArrows()) {
        args.userArrows.end(at(event));
        clearRectCache();
        return;
      }
      const sq = at(event);
      const before = args.session.state();
      args.session.up(sq);
      args.setDragAt(null);
      clearRectCache();
      if (before.kind === 'drag' && sq !== null && sq !== before.from) {
        args.model.markSnap(sq);
      }
    },
    onPointerCancel() {
      args.session.cancel();
      args.setDragAt(null);
      clearRectCache();
    },
  };
}

function createKeyPart(
  args: HandlerArgs
): Pick<BoardHandlers, 'onKeyDown' | 'onContextMenu'> {
  return {
    onKeyDown(event) {
      if (isArrowKey(event.key)) {
        event.preventDefault();
        const next = moveCursor(args.cursor(), event.key, args.orientation());
        if (next !== null) args.setCursor(next);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        args.session.down(args.cursor());
        args.session.up(args.cursor());
      }
    },
    onContextMenu(event) {
      if (!args.enableUserArrows()) return;
      event.preventDefault();
      const node = args.host();
      if (node === undefined) return;
      const rect = node.getBoundingClientRect();
      const sq = squareFromRect({
        event,
        rect,
        boardPx: args.boardPx(),
        orientation: args.orientation(),
      });
      if (sq !== null) args.userArrows.begin(sq);
    },
  };
}

export function createBoardHandlers(args: HandlerArgs): BoardHandlers {
  return { ...createPointerPart(args), ...createKeyPart(args) };
}
