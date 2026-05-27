/**
 * Motion design tokens shared across the design system. Mirrors Material 3 /
 * the modern web baseline: short, snappy interactions; longer, decelerated
 * entrances; instant feedback for the smallest gestures.
 *
 * Durations are milliseconds. Easings are CSS `cubic-bezier()` strings --
 * usable directly with web CSS / Animated `Easing.bezier()` (split the
 * control points) / `react-native-reanimated` `withTiming`.
 */

export const duration = {
  /** Immediate ack (focus rings, pressed tints). */
  instant: 80,
  /** Most micro-interactions (hover, press, switch thumb). */
  fast: 150,
  /** Default for layout-affecting transitions (menu open, tab change). */
  normal: 200,
  /** Modal / overlay entrance + dismissive transitions. */
  slow: 300,
  /** Splash / large-area shimmer cycles. */
  slower: 500,
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

export type Motion = typeof motion;
