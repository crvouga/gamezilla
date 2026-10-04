/**
 * Pure color operations on typed {@link Rgba} values.
 */

import { hslaToRgba, rgbaToHsla } from './convert';
import type { Rgba } from './types';
import { clamp01, rgba } from './types';

/**
 * Shift lightness by `delta` (e.g. `-0.1` darkens). Hue, saturation, and
 * alpha are preserved. Result lightness is clamped to `[0, 1]`.
 */
export function adjustLightness(color: Rgba, delta: number): Rgba {
  const hsla = rgbaToHsla(color);
  return hslaToRgba({
    h: hsla.h,
    s: hsla.s,
    l: clamp01(hsla.l + delta),
    a: hsla.a,
  });
}

/** Return a copy with alpha set to `a` (clamped to `[0, 1]`). */
export function setAlpha(color: Rgba, a: number): Rgba {
  return rgba(color.r, color.g, color.b, a);
}

/**
 * Linear mix in RGB space. `t = 0` → `a`, `t = 1` → `b`.
 * `t` is clamped to `[0, 1]`.
 */
export function mix(a: Rgba, b: Rgba, t: number): Rgba {
  const u = clamp01(t);
  const v = 1 - u;
  return rgba(
    a.r * v + b.r * u,
    a.g * v + b.g * u,
    a.b * v + b.b * u,
    a.a * v + b.a * u
  );
}
