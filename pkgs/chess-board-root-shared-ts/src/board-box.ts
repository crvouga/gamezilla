/**
 * The painted board in viewport pixels: the host's content box (inside its
 * border), where squares, pieces and the hit grid are drawn. Measured once
 * per press (one layout read); every `pointermove` is then pure arithmetic.
 */

import { toDisplayFileRank } from '@pkgs/chess-board-core-shared-ts/geometry';
import type {
  BoardOrientation,
  Square,
} from '@pkgs/chess-board-core-shared-ts/types';

export type BoardBox = {
  readonly left: number;
  readonly top: number;
  readonly size: number;
};

/** Board-local pixel point. */
export type BoardPoint = {
  readonly x: number;
  readonly y: number;
};

/**
 * Measure at the start of a press. CSS width stays current before a queued
 * ResizeObserver delivery and preserves the fractional border-box width;
 * an observer's previous measurement cannot determine the current scale.
 * The press cache keeps style and layout reads out of pointer movement.
 */
export function measureBoardBox(
  node: HTMLElement,
  fallbackPx: number
): BoardBox {
  const rect = node.getBoundingClientRect();
  const cssWidth = Number.parseFloat(
    node.ownerDocument.defaultView?.getComputedStyle(node).width ?? ''
  );
  const width =
    Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : fallbackPx;
  const scale = width > 0 ? rect.width / width : 1;
  const borderX = node.clientLeft * scale;
  const borderY = node.clientTop * scale;
  const inner = rect.width - 2 * borderX;
  return {
    left: rect.left + borderX,
    top: rect.top + borderY,
    size: Number.isFinite(inner) && inner > 0 ? inner : 0,
  };
}

export type BoardBoxCache = {
  /** Measure (first call of a press) or return the cached box. */
  readonly get: (node: HTMLElement, fallbackPx: number) => BoardBox;
  /** Forget the box and stop watching (press over). */
  readonly clear: () => void;
};

/**
 * The box is read once per press. It goes stale only if the page scrolls or
 * the window resizes mid-press (a mouse wheel during a drag); both just drop
 * the cache so the next event re-measures. The listeners exist only while a
 * box is cached — no observer is created per press (a ResizeObserver's
 * initial callback would re-measure right after every pick-up).
 */
export function createBoardBoxCache(): BoardBoxCache {
  let cached: BoardBox | null = null;
  let win: Window | null = null;
  const stale = (): void => {
    cached = null;
  };
  const unwatch = (): void => {
    win?.removeEventListener('scroll', stale, true);
    win?.removeEventListener('resize', stale);
    win = null;
  };
  return {
    get(node, fallbackPx) {
      if (cached !== null) return cached;
      cached = measureBoardBox(node, fallbackPx);
      if (win === null) {
        win = node.ownerDocument.defaultView;
        win?.addEventListener('scroll', stale, {
          capture: true,
          passive: true,
        });
        win?.addEventListener('resize', stale, { passive: true });
      }
      return cached;
    },
    clear() {
      cached = null;
      unwatch();
    },
  };
}

export function toBoardPoint(
  box: BoardBox,
  event: { readonly clientX: number; readonly clientY: number }
): BoardPoint {
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

/** Screen cell under a board-local point, or null off the board. */
export function cellAt(
  box: BoardBox,
  point: BoardPoint
): { col: number; row: number } | null {
  if (!Number.isFinite(box.size) || box.size <= 0) return null;
  const { x, y } = point;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || y < 0 || x >= box.size || y >= box.size) return null;
  const cell = box.size / 8;
  return { col: Math.floor(x / cell), row: Math.floor(y / cell) };
}

/** Square under a board-local point, or null off the board. */
export function squareAt(
  box: BoardBox,
  point: BoardPoint,
  orientation: BoardOrientation
): Square | null {
  const cell = cellAt(box, point);
  if (cell === null) return null;
  const { file, rank } = toDisplayFileRank(orientation, cell.row, cell.col);
  return `${String.fromCharCode(97 + file)}${String.fromCharCode(49 + rank)}` as Square;
}
