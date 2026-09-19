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
import { brushFromModifiers, type UserShapes } from './chess-board-user-shapes';
import type { ChessBoardModel } from './create-chess-board-model';
import type { DragGhostController } from './drag-ghost-controller';
import { isArrowKey, moveCursor } from './keyboard-nav';
import type { PointerSession } from './pointer-session';

/**
 * The painted board: the host's content box (inside its border), where the
 * squares, pieces and hit grid are drawn. Pointer math must use this box —
 * the border box or the snapped `boardPx` shifts taps near square edges.
 */
type BoardBox = {
  readonly left: number;
  readonly top: number;
  readonly size: number;
};

function borderPx(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function measureBoardBox(node: HTMLElement, fallbackPx: number): BoardBox {
  const rect = node.getBoundingClientRect();
  const style = node.ownerDocument.defaultView?.getComputedStyle(node);
  const left = borderPx(style?.borderLeftWidth ?? '');
  const right = borderPx(style?.borderRightWidth ?? '');
  const top = borderPx(style?.borderTopWidth ?? '');
  const size = rect.width - left - right;
  return {
    left: rect.left + left,
    top: rect.top + top,
    size: size > 0 ? size : fallbackPx,
  };
}

export type BoardHandlers = {
  readonly onPointerDown: (event: PointerEvent) => void;
  readonly onPointerMove: (event: PointerEvent) => void;
  readonly onPointerUp: (event: PointerEvent) => void;
  readonly onPointerCancel: () => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
  readonly onContextMenu: (event: MouseEvent) => void;
  /** A hit-grid square button took focus: the cursor follows it. */
  readonly onSquareFocus: (square: Square) => void;
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
  cached: BoardBox | null;
  ro: ResizeObserver | null;
};

function clearRectCache(cache: RectCache): void {
  cache.cached = null;
  if (cache.ro !== null) {
    cache.ro.disconnect();
    cache.ro = null;
  }
}

function ensureRect(
  cache: RectCache,
  node: HTMLElement,
  fallbackPx: number
): BoardBox {
  if (cache.cached !== null) return cache.cached;
  cache.cached = measureBoardBox(node, fallbackPx);
  cache.ro = new ResizeObserver(() => {
    cache.cached = measureBoardBox(node, fallbackPx);
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
  const box = ensureRect(cache, node, args.boardPx());
  return {
    x: pxToUnits(event.clientX - box.left, box.size),
    y: pxToUnits(event.clientY - box.top, box.size),
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
  const box = ensureRect(cache, node, args.boardPx());
  return xyToSquare(
    event.clientX - box.left,
    event.clientY - box.top,
    box.size,
    args.orientation()
  );
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
      ensureRect(cache, node, args.boardPx());
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

/** Roving focus: the cursor square's button holds keyboard focus. */
function focusSquare(host: HTMLElement | undefined, square: Square): void {
  const button = host?.querySelector<HTMLElement>(`[data-square="${square}"]`);
  button?.focus();
}

function createKeyPart(
  args: HandlerArgs
): Pick<BoardHandlers, 'onKeyDown' | 'onContextMenu' | 'onSquareFocus'> {
  return {
    onSquareFocus(square) {
      args.setCursor(square);
    },
    onKeyDown(event) {
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
        brushFromModifiers(
          event.shiftKey,
          event.altKey,
          event.ctrlKey || event.metaKey
        )
      );
    },
  };
}

export function createBoardHandlers(args: HandlerArgs): BoardHandlers {
  return { ...createPointerPart(args), ...createKeyPart(args) };
}
