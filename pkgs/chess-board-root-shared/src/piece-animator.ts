/**
 * Piece placement. Every piece is a one-cell HTML box whose inline
 * `transform` is its resting place; a slide is a compositor animation from
 * wherever the piece is *painted now* to that resting place:
 *
 * - a normal move slides from the previous square;
 * - a drop settles from under the pointer (the drag left it there);
 * - an illegal / cancelled drag springs back from under the pointer;
 * - a move that lands mid-slide (fast replies, history scrubbing) retargets
 *   from the painted mid-flight position instead of jumping.
 *
 * Main-thread cost per placement: one style write and, when sliding, one
 * `animate` call. The only style read is the mid-flight retarget.
 */

import type { AnimateTransform, MotionHandle } from './board-motion';

export type PieceAnimatorArgs = {
  /** Current animate capability (`null`: snap). */
  readonly animate: () => AnimateTransform | null;
  /** Painted transform of an element (computed style); mid-flight only. */
  readonly paintedTransform: (element: HTMLElement) => string;
};

export type PlaceOptions = {
  /** Slide there (else snap). */
  readonly slide: boolean;
  readonly durationMs: number;
};

export type PieceAnimator = {
  /** Rest `element` on `target`, sliding from where it is painted now. */
  readonly place: (
    element: HTMLElement,
    target: string,
    options: PlaceOptions
  ) => void;
  /**
   * A drag takes `element` (stopping any slide where it is painted). Until
   * {@link release}, placements only move its resting place: the pointer
   * owns the transform.
   */
  readonly grab: (element: HTMLElement) => void;
  /**
   * The drag let go: settle onto the resting place — the new square after a
   * legal drop, the origin after an illegal / cancelled one.
   */
  readonly release: (element: HTMLElement, options: PlaceOptions) => void;
  /** Resting transform last given to `element`, if any. */
  readonly restingOf: (element: HTMLElement) => string | undefined;
  /** Forget a removed piece, cancelling any old completion. */
  readonly remove: (element: HTMLElement) => void;
  /** Cancel every running slide (unmount). */
  readonly dispose: () => void;
};

const MATRIX = /^matrix\(([^)]+)\)$/;

/**
 * `matrix(a, b, c, d, e, f)` → `translate(epx, fpx)` for a pure translation
 * (what a slide paints); anything else passes through unchanged.
 */
export function translateOfMatrix(painted: string): string {
  const match = MATRIX.exec(painted.trim());
  if (match === null) return painted === 'none' ? '' : painted;
  const parts = (match[1] ?? '').split(',').map((p) => Number(p.trim()));
  const [a, b, c, d, e, f] = parts;
  if (a !== 1 || b !== 0 || c !== 0 || d !== 1) return painted;
  return `translate(${e ?? 0}px, ${f ?? 0}px)`;
}

export function createPieceAnimator(args: PieceAnimatorArgs): PieceAnimator {
  const resting = new WeakMap<HTMLElement, string>();
  const running = new Map<HTMLElement, MotionHandle>();
  const grabbed = new WeakSet<HTMLElement>();

  const stop = (element: HTMLElement): boolean => {
    const handle = running.get(element);
    if (handle === undefined) return false;
    running.delete(element);
    handle.cancel();
    return true;
  };

  const slide = (
    element: HTMLElement,
    from: string,
    to: string,
    durationMs: number
  ): void => {
    const animate = args.animate();
    if (animate === null || from === '' || from === to || durationMs <= 0) {
      return;
    }
    const handle = animate(element, from, to, durationMs);
    running.set(element, handle);
    handle.onFinish(() => {
      if (running.get(element) === handle) running.delete(element);
    });
  };

  const moveTo = (
    element: HTMLElement,
    target: string,
    options: PlaceOptions
  ): void => {
    const midFlight = running.has(element);
    let from = element.style.transform;
    if (midFlight) {
      if (options.slide)
        from = translateOfMatrix(args.paintedTransform(element));
      stop(element);
    }
    resting.set(element, target);
    element.style.transform = target;
    if (options.slide) slide(element, from, target, options.durationMs);
  };

  return {
    place(element, target, options) {
      if (grabbed.has(element)) {
        resting.set(element, target);
        return;
      }
      // Already resting there, or already sliding there: keep that slide.
      if (
        resting.get(element) === target &&
        (running.has(element) || element.style.transform === target)
      ) {
        return;
      }
      moveTo(element, target, options);
    },
    grab(element) {
      grabbed.add(element);
      if (!running.has(element)) return;
      const painted = translateOfMatrix(args.paintedTransform(element));
      stop(element);
      if (painted !== '') element.style.transform = painted;
    },
    release(element, options) {
      if (!grabbed.delete(element)) return;
      const target = resting.get(element);
      if (target === undefined || element.style.transform === target) return;
      moveTo(element, target, options);
    },
    restingOf: (element) => resting.get(element),
    remove(element) {
      stop(element);
      grabbed.delete(element);
      resting.delete(element);
    },
    dispose() {
      for (const handle of running.values()) handle.cancel();
      running.clear();
    },
  };
}
