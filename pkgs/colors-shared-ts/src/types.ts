/**
 * Typed color spaces. All RGB/HSL channel components are in `[0, 1]`.
 * Hue is degrees in `[0, 360)`.
 */

export type Rgb = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

export type Rgba = Rgb & {
  readonly a: number;
};

export type Hsl = {
  readonly h: number;
  readonly s: number;
  readonly l: number;
};

export type Hsla = Hsl & {
  readonly a: number;
};

/** Canonical working color (RGBA, channels in `[0, 1]`). */
export type Color = Rgba;

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Wrap hue into `[0, 360)`. */
export function wrapHue(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function rgb(r: number, g: number, b: number): Rgb {
  return { r: clamp01(r), g: clamp01(g), b: clamp01(b) };
}

export function rgba(r: number, g: number, b: number, a: number): Rgba {
  return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a: clamp01(a) };
}

export function hsl(h: number, s: number, l: number): Hsl {
  return { h: wrapHue(h), s: clamp01(s), l: clamp01(l) };
}

export function hsla(h: number, s: number, l: number, a: number): Hsla {
  return { h: wrapHue(h), s: clamp01(s), l: clamp01(l), a: clamp01(a) };
}

export function rgbToRgba(c: Rgb, a = 1): Rgba {
  return rgba(c.r, c.g, c.b, a);
}

export function hslToHsla(c: Hsl, a = 1): Hsla {
  return hsla(c.h, c.s, c.l, a);
}
