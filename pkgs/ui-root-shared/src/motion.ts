/**
 * Motion design tokens, read from `design-tokens.json`. Durations are short
 * and CSS-driven (compositor transitions only — no JS-thread animation),
 * exposed as `--ui-duration-*` / `--ui-easing-*` in `tokens.css`.
 *
 * - `instant` immediate ack (focus rings, pressed tints); `fast` most
 *   micro-interactions (hover, press, switch thumb); `normal` layout-affecting
 *   transitions (menu open, tab change); `slow` modal / overlay entrance and
 *   dismissal; `slower` splash and large-area shimmer cycles.
 * - `standard` decelerates into rest; `decelerate` for elements entering the
 *   screen; `accelerate` for elements leaving; `inOut` for shimmer / pulse
 *   loops; `playful` a slight overshoot for compositor-only presses.
 */

import { readCubicBezier, readGroup, readMs } from './design-tokens';
import { motion as motionTokens } from './design-tokens.json';

/** Milliseconds per named duration. */
export const duration = readGroup({}, motionTokens.duration, readMs);

export type DurationKey = keyof typeof duration;

/** CSS `cubic-bezier(…)` per named curve. */
export const easing = readGroup({}, motionTokens.easing, readCubicBezier);

export type EasingKey = keyof typeof easing;

export const motion = { duration, easing } as const;

export type MotionTokens = typeof motion;
