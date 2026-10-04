/**
 * WCAG relative luminance and contrast ratio on typed RGB channels `[0, 1]`.
 */

import type { Rgb } from './types';
import { clamp01 } from './types';

function linearizeChannel(channel: number): number {
  const s = clamp01(channel);
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance (`0` = black, `1` = white). */
export function relativeLuminance(c: Rgb): number {
  return (
    0.2126 * linearizeChannel(c.r) +
    0.7152 * linearizeChannel(c.g) +
    0.0722 * linearizeChannel(c.b)
  );
}

/** WCAG contrast ratio between two colors (`1` … `21`). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
