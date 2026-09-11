/**
 * Pointer / keyboard handlers for the chess board host.
 */

import { indexFromSquare, xyToSquare } from '@pkgs/chess-board-core/geometry';
import { pieceCode } from '@pkgs/chess-board-core/piece-svgs';
import type {
  BoardOrientation,
  PieceCode,
  Square,
} from '@pkgs/chess-board-core/types';
import type { Accessor, Setter } from 'solid-js';

import { pxToUnits } from './board-units';
import type { ChessBoardModel } from './create-chess-board-model';
import type { DragGhostController } from './drag-ghost-controller';
import { isArrowKey, moveCursor } from './keyboard-nav';
import type { PointerSession } from './pointer-session';
import {
  brushFromModifiers,
  type UserShapes,
} from './chess-board-user-shapes';

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
  readonly userArrows: UserShapes;
  readonly cursor: Accessor<Square>;
  readonly setCursor: Setter<Square>;
  readonly ghost: DragGhostController;
};

type RectCache = {
  cached: DOMRect | null;
  ro: ResizeObserver | null;
};

function clearRectCache(cache: RectCache): void {
  cache.cached = null;
  if (cache.ro !== null) {
    cache.ro.disconnect();
    cache.ro = null;
  }
}

function ensureRect(cache: RectCache, node: HTMLElement): DOMRect {
  if (cache.cached !== null) return cache.cached;
  cache.cached = node.getBoundingClientRect();
  cache.ro = new ResizeObserver(() => {
    cache.cached = node.getBoundingClientRect();
  });
  cache.ro.observe(node);
  return cache.cached;
}

function unitsFromEvent(
  args: HandlerArgs,
  cache: RectCache,
  event: { clientX: number; clientY: number }
): { x: number; y: number } | null {
  const node = args.host();
  if (node === undefined) return null;
  const rect = ensureRect(cache, node);
  const px = args.boardPx();
  return {
    x: pxToUnits(event.clientX - rect.left, px),
    y: pxToUnits(event.clientY - rect.top, px),
  };
}

function pieceCodeAt(model: ChessBoardModel, square: Square): PieceCode | null {
  const piece = model.game().position[indexFromSquare(square)];
  if (piece === null || piece === undefined) return null;
  return pieceCode(piece.color, piece.type);
}

function atSquare(
  args: HandlerArgs,
  cache: RectCache,
  event: { clientX: number; clientY: number }
): Square | null {
  const node = args.host();
  if (node === undefined) return null;
  return squareFromRect({
    event,
    rect: ensureRect(cache, node),
    boardPx: args.boardPx(),
    orientation: args.orientation(),
  });
}

function beginGhostDrag(
  args: HandlerArgs,
  cache: RectCache,
  event: PointerEvent
): void {
  const st = args.session.state();
  if (st.kind !== 'drag') return;
  const units = unitsFromEvent(args, cache, event);
  const code = pieceCodeAt(args.model, st.from);
  if (units === null || code === null) return;
  args.ghost.begin({
    code,
    x: units.x,
    y: units.y,
    touch: event.pointerType === 'touch',
  });
}

function createPointerPart(
  args: HandlerArgs
): Pick<
  BoardHandlers,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
> {
  const cache: RectCache = { cached: null, ro: null };
  return {
    onPointerDown(event) {
      const node = args.host();
      if (node === undefined || event.button !== 0) return;
      if (args.enableUserArrows()) args.userArrows.clear();
      node.setPointerCapture(event.pointerId);
      clearRectCache(cache);
      ensureRect(cache, node);
      const sq = atSquare(args, cache, event);
      args.session.down(sq, event.clientX, event.clientY, event.pointerType);
      if (sq !== null) args.setCursor(sq);
    },
    onPointerMove(event) {
      const promoted = args.session.move(event.clientX, event.clientY);
      if (args.session.state().kind !== 'drag') return;
      if (promoted) {
        beginGhostDrag(args, cache, event);
        return;
      }
      const units = unitsFromEvent(args, cache, event);
      if (units !== null) args.ghost.moveTo(units.x, units.y);
    },
    onPointerUp(event) {
      if (event.button === 2 && args.enableUserArrows()) {
        args.userArrows.end(atSquare(args, cache, event));
        clearRectCache(cache);
        return;
      }
      const sq = atSquare(args, cache, event);
      const before = args.session.state();
      args.session.up(sq);
      args.ghost.end();
      clearRectCache(cache);
      if (before.kind === 'drag' && sq !== null && sq !== before.from) {
        args.model.markSnap(sq);
      }
    },
    onPointerCancel() {
      args.session.cancel();
      args.ghost.end();
      clearRectCache(cache);
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
      const cache: RectCache = { cached: null, ro: null };
      const sq = atSquare(args, cache, event);
      clearRectCache(cache);
      if (sq === null) return;
      args.userArrows.begin(
        sq,
        brushFromModifiers(event.shiftKey, event.altKey, event.ctrlKey || event.metaKey)
      );
    },
  };
}

export function createBoardHandlers(args: HandlerArgs): BoardHandlers {
  return { ...createPointerPart(args), ...createKeyPart(args) };
}
