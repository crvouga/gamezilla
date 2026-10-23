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

/**
 * One change of position, shared by every piece it re-places. A move slides
 * its pieces. A replacement position (a reset, a jump) slides them when the
 * board is at rest; one that interrupts an arrival settles every piece at
 * once, so no piece is sent somewhere new in mid-flight.
 */
export type Arrival = {
  /** Identity of the change: the same rows are the same arrival. */
  readonly rows: unknown;
  readonly replacement: boolean;
};

export type PlaceOptions = {
  /** Slide there (else snap). */
  readonly slide: boolean;
  readonly durationMs: number;
  /** The position change this placement belongs to, when it is one. */
  readonly arrival?: Arrival;
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
  /**
   * A new position is being placed. Decides once per {@link Arrival} whether
   * its pieces slide; {@link place} calls it too, whichever comes first.
   */
  readonly arrive: (arrival: Arrival) => void;
  /**
   * A gesture begins. A replacement position still arriving is placed at
   * once, so nobody takes hold of a piece in mid-flight; a move's arrival
   * carries on.
   */
  readonly interrupt: () => void;
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

type Running = Map<HTMLElement, MotionHandle>;

function stopSlide(running: Running, element: HTMLElement): boolean {
  const handle = running.get(element);
  if (handle === undefined) return false;
  running.delete(element);
  handle.cancel();
  return true;
}

function startSlide(
  running: Running,
  animate: AnimateTransform | null,
  slide: {
    readonly element: HTMLElement;
    readonly from: string;
    readonly to: string;
    readonly durationMs: number;
  }
): void {
  if (animate === null) return;
  const { element } = slide;
  const handle = animate(element, slide.from, slide.to, slide.durationMs);
  running.set(element, handle);
  handle.onFinish(() => {
    if (running.get(element) === handle) running.delete(element);
  });
}

/**
 * Decides, once per {@link Arrival}, whether its pieces slide, and remembers
 * whether a replacement position is the one arriving.
 */
function createArrivalGate(busy: () => boolean, settle: () => void) {
  let rows: unknown;
  let slides = true;
  let replacementArriving = false;
  return {
    arrive(arrival: Arrival): void {
      if (arrival.rows === rows) return;
      rows = arrival.rows;
      slides = !arrival.replacement || !busy();
      replacementArriving = arrival.replacement && slides;
      if (!slides) settle();
    },
    interrupt(): void {
      if (replacementArriving) settle();
      replacementArriving = false;
    },
    slides: () => slides,
  };
}

export function createPieceAnimator(args: PieceAnimatorArgs): PieceAnimator {
  const resting = new WeakMap<HTMLElement, string>();
  const running: Running = new Map();
  const grabbed = new WeakSet<HTMLElement>();

  const stop = (element: HTMLElement): boolean => stopSlide(running, element);
  const slide = (
    element: HTMLElement,
    from: string,
    to: string,
    durationMs: number
  ): void => {
    if (from === '' || from === to || durationMs <= 0) return;
    startSlide(running, args.animate(), { element, from, to, durationMs });
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

  const settle = (): void => {
    for (const handle of running.values()) handle.cancel();
    running.clear();
  };

  const gate = createArrivalGate(() => running.size > 0, settle);

  return {
    place(element, target, options) {
      if (options.arrival !== undefined) gate.arrive(options.arrival);
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
      const slides =
        options.slide && (options.arrival === undefined || gate.slides());
      moveTo(element, target, { ...options, slide: slides });
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
    arrive: gate.arrive,
    interrupt: gate.interrupt,
    dispose: settle,
  };
}
