/**
 * Motion design tokens, read from `design-tokens.json`. Durations are short
 * and CSS-driven (compositor transitions only, no JS-thread animation),
 * exposed as `--ui-duration-*` / `--ui-easing-*` in `tokens.css`.
 *
 * - `instant` is no motion; `fast` (150ms) hover, press and focus feedback;
 *   `normal` (200ms) a control changing state (switch, tab, segment);
 *   `slow` (250ms) a surface entering or leaving (dialog, sheet, toast).
 * - `standard` is the one curve: ease-out into rest.
 * - `prefers-reduced-motion` turns every transition off (`skin.css`).
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
