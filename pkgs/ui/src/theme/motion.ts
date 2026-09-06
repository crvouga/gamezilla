/**
 * Motion design tokens. Durations are short and CSS-driven (compositor
 * transitions only — no JS-thread animation), exposed as
 * `--ui-duration-*` / `--ui-easing-*` in `tokens.css`.
 */

export const duration = {
  /** Immediate ack (focus rings, pressed tints). */
  instant: 0,
  /** Most micro-interactions (hover, press, switch thumb). */
  fast: 120,
  /** Default for layout-affecting transitions (menu open, tab change). */
  normal: 200,
  /** Modal / overlay entrance + dismissive transitions. */
  slow: 280,
  /** Splash / large-area shimmer cycles. */
  slower: 600,
} as const;

export type DurationKey = keyof typeof duration;

export const easing = {
  /** Standard for most transitions -- decelerates into rest. */
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  /** Use for elements entering the screen. */
  decelerate: 'cubic-bezier(0, 0, 0, 1)',
  /** Use for elements leaving the screen. */
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  /** Symmetric ease-in-out, useful for shimmer / pulse loops. */
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export type EasingKey = keyof typeof easing;

export const motion = { duration, easing } as const;

export type MotionTokens = typeof motion;
