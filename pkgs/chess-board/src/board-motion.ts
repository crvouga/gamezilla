/**
 * How the board moves, decided once from everything that should limit it:
 * the parent's `animations` / `animationDurationMs` props, the person's
 * "reduce motion" setting (iOS Reduce Motion, Android "Remove animations",
 * Windows / macOS animation toggles all surface as
 * `prefers-reduced-motion`), whether the device is low-end, and whether the
 * engine can run compositor animations at all.
 *
 * Slides only ever animate `transform` (and the capture fade `opacity`), the
 * two properties suitable for compositor animation. Frame performance is
 * checked separately from the final rules state.
 */

import type { Accessor } from 'solid-js';

/** Chess.com's default piece speed. */
export const DEFAULT_MOVE_DURATION_MS = 150;
/** A drop settling onto its square / an illegal drop springing back. */
export const MAX_SETTLE_DURATION_MS = 90;

/** A running animation the board can stop. */
export type MotionHandle = {
  readonly cancel: () => void;
  /** Called once when the animation runs to completion (not on cancel). */
  readonly onFinish: (callback: () => void) => void;
};

/**
 * Start a compositor transform animation on `element` (Web Animations
 * `Element.animate` in browsers). The keyframes are `transform` only.
 */
export type AnimateTransform = (
  element: HTMLElement,
  from: string,
  to: string,
  durationMs: number
) => MotionHandle;

export type BoardMotionEnvironment = {
  /** `null` when the engine has no Web Animations: pieces snap. */
  readonly animate: AnimateTransform | null;
  /** The OS / browser asks for reduced motion. Live. */
  readonly prefersReducedMotion: Accessor<boolean>;
  /** Few cores / little memory / Save-Data: drop paint-heavy effects. */
  readonly lowEnd: boolean;
  /** The page is not visible: a slide nobody sees is skipped. */
  readonly hidden: () => boolean;
  /** Painted transform of an element mid-slide (a style read; rare path). */
  readonly paintedTransform: (element: HTMLElement) => string;
};

export type MotionPolicyInput = {
  /** Parent `animations` prop (default on). */
  readonly enabled: boolean;
  /** Parent `animationDurationMs` prop (default {@link DEFAULT_MOVE_DURATION_MS}). */
  readonly durationMs: number | undefined;
  readonly prefersReducedMotion: boolean;
  readonly lowEnd: boolean;
  /** The engine runs Web Animations (else pieces can only snap). */
  readonly canAnimate: boolean;
};

export type MotionPolicy = {
  /** Pieces slide between squares (and the capture ghost covers the slide). */
  readonly slides: boolean;
  /** Slide duration; 0 when slides are off. */
  readonly durationMs: number;
  /**
   * Paint-heavy polish (the capture fade). Off on low-end devices, where
   * every extra paint competes with the drag.
   */
  readonly effects: boolean;
};

const OFF: MotionPolicy = { slides: false, durationMs: 0, effects: false };

export function resolveMotionPolicy(input: MotionPolicyInput): MotionPolicy {
  if (!input.enabled || input.prefersReducedMotion || !input.canAnimate) {
    return OFF;
  }
  if (input.durationMs !== undefined && !Number.isFinite(input.durationMs))
    return OFF;
  const durationMs = Math.max(
    0,
    Math.round(input.durationMs ?? DEFAULT_MOVE_DURATION_MS)
  );
  if (durationMs === 0) return OFF;
  return { slides: true, durationMs, effects: !input.lowEnd };
}

/** Settle / snap-back duration for a move duration. */
export function settleDurationMs(moveDurationMs: number): number {
  return Math.min(moveDurationMs, MAX_SETTLE_DURATION_MS);
}

type NavigatorHints = {
  readonly hardwareConcurrency?: number;
  readonly deviceMemory?: number;
  readonly connection?: { readonly saveData?: boolean };
};

/**
 * Low-end heuristic over `navigator` hints: ≤ 2 GB (Chrome's
 * `deviceMemory`), ≤ 2 logical cores, or Data Saver on. Missing hints never
 * count against the device.
 */
export function isLowEndDevice(hints: NavigatorHints | undefined): boolean {
  if (hints === undefined) return false;
  if (hints.deviceMemory !== undefined && hints.deviceMemory <= 2) return true;
  if (
    hints.hardwareConcurrency !== undefined &&
    hints.hardwareConcurrency > 0 &&
    hints.hardwareConcurrency <= 2
  ) {
    return true;
  }
  return hints.connection?.saveData === true;
}
