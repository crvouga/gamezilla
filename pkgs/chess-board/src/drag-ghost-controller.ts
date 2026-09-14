/**
 * Imperative drag ghost: `pointermove` only mutates `transform` via an
 * rAF-batched write. No Solid signals on the hot path.
 */

import type { PieceCode } from '@pkgs/chess-board-core/types';

import { CELL_UNITS } from './board-units';

const HALF = CELL_UNITS / 2;
const TOUCH_LIFT = CELL_UNITS * 0.15;
const TOUCH_SCALE = 1.08;

export type FrameScheduler = (cb: FrameRequestCallback) => number;
export type FrameCanceller = (id: number) => void;

export type DragGhostController = {
  setElement(el: SVGElement | HTMLElement | null): void;
  begin(args: { code: PieceCode; x: number; y: number; touch: boolean }): void;
  /** rAF-batched; mutates transform only (no object alloc after begin). */
  moveTo(x: number, y: number): void;
  end(): void;
  isActive(): boolean;
};

export function createDragGhostController(
  scheduleFrame: FrameScheduler,
  cancelFrame: FrameCanceller
): DragGhostController {
  let el: SVGElement | HTMLElement | null = null;
  let active = false;
  let pendingX = 0;
  let pendingY = 0;
  let rafId = 0;
  let liftY = 0;
  let scale = 1;
  let code: PieceCode | null = null;

  const cancelRaf = (): void => {
    if (rafId === 0) return;
    cancelFrame(rafId);
    rafId = 0;
  };

  const writeTransform = (): void => {
    const node = el;
    if (node === null) return;
    const tx = pendingX - HALF;
    const ty = pendingY - HALF - liftY;
    if (node instanceof SVGElement) {
      node.setAttribute(
        'transform',
        scale === 1
          ? `translate(${tx} ${ty})`
          : `translate(${tx} ${ty}) scale(${scale})`
      );
      return;
    }
    // HTML overlay path (tests / optional non-SVG hosts).
    node.style.transform =
      scale === 1
        ? `translate(${tx}px,${ty}px)`
        : `translate(${tx}px,${ty}px) scale(${scale})`;
  };

  const flush = (): void => {
    rafId = 0;
    if (!active) return;
    writeTransform();
  };

  return {
    setElement(next) {
      el = next;
      if (next !== null && active) writeTransform();
    },
    begin(args) {
      active = true;
      code = args.code;
      liftY = args.touch ? TOUCH_LIFT : 0;
      scale = args.touch ? TOUCH_SCALE : 1;
      pendingX = args.x;
      pendingY = args.y;
      cancelRaf();
      writeTransform();
      if (el !== null) {
        el.style.visibility = 'visible';
        el.dataset['piece'] = code;
      }
    },
    moveTo(x, y) {
      if (!active) return;
      pendingX = x;
      pendingY = y;
      if (rafId !== 0) return;
      rafId = scheduleFrame(flush);
    },
    end() {
      cancelRaf();
      active = false;
      code = null;
      liftY = 0;
      scale = 1;
      if (el !== null) {
        el.style.visibility = 'hidden';
        if (el instanceof SVGElement) {
          el.removeAttribute('transform');
        } else {
          el.style.transform = '';
        }
        delete el.dataset['piece'];
      }
    },
    isActive: () => active,
  };
}
