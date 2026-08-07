/**
 * RGB ↔ HSL conversions. Channels in `[0, 1]`; hue in degrees `[0, 360)`.
 */

import {
  clamp01,
  type Hsl,
  type Hsla,
  hsl,
  hsla,
  type Rgb,
  type Rgba,
  rgb,
  rgba,
  wrapHue,
} from './types';

function hueToRgbComponent(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

export function rgbToHsl(c: Rgb): Hsl {
  const r = clamp01(c.r);
  const g = clamp01(c.g);
  const b = clamp01(c.b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return hsl(0, 0, l);
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return hsl(h * 360, s, l);
}

export function hslToRgb(c: Hsl): Rgb {
  const h = wrapHue(c.h) / 360;
  const s = clamp01(c.s);
  const l = clamp01(c.l);
  if (s === 0) return rgb(l, l, l);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return rgb(
    hueToRgbComponent(p, q, h + 1 / 3),
    hueToRgbComponent(p, q, h),
    hueToRgbComponent(p, q, h - 1 / 3)
  );
}

export function rgbaToHsla(c: Rgba): Hsla {
  const { h, s, l } = rgbToHsl(c);
  return hsla(h, s, l, clamp01(c.a));
}

export function hslaToRgba(c: Hsla): Rgba {
  const { r, g, b } = hslToRgb(c);
  return rgba(r, g, b, clamp01(c.a));
}
