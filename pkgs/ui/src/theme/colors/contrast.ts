/**
 * WCAG contrast helpers + automatic on-color resolution.
 *
 * Given any CSS color string (`#rgb`, `#rrggbb(aa)`, `rgb(a)`, `hsl(a)`) these
 * helpers compute relative luminance and contrast ratios, then pick the
 * foreground set (`fg`, `fgMuted`, `icon`) that reads with the highest
 * contrast on top of a colored surface. This lets colored surfaces
 * (gradients, brand fills, avatars) hand their children a guaranteed-legible
 * foreground instead of leaning on a hardcoded `#fff`.
 *
 * App-agnostic: the default light/dark candidate sets are plain CSS colors,
 * not product tokens, so this module never reaches into any specific palette.
 */

export type Rgb = { r: number; g: number; b: number };

/** Foreground colors to render on top of a given background. */
export type OnColorSet = {
  /** Primary label color (full strength). */
  fg: string;
  /** Secondary / caption color (same family, reduced emphasis). */
  fgMuted: string;
  /** Icon color (slightly softer than `fg`, still high contrast). */
  icon: string;
};

/** Foreground set for use on dark backgrounds (white family). */
export const ON_DARK: OnColorSet = {
  fg: 'hsla(0, 0%, 100%, 1)',
  fgMuted: 'hsla(0, 0%, 100%, 0.76)',
  icon: 'hsla(0, 0%, 100%, 0.92)',
};

/** Foreground set for use on light backgrounds (near-black family). */
export const ON_LIGHT: OnColorSet = {
  fg: 'hsla(240, 10%, 4%, 1)',
  fgMuted: 'hsla(240, 10%, 4%, 0.64)',
  icon: 'hsla(240, 10%, 4%, 0.82)',
};

function clamp255(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return Math.round(value);
}

function expandShortHex(hex: string): string {
  let out = '';
  for (const ch of hex) out += ch + ch;
  return out;
}

function parseHex(input: string): Rgb | null {
  if (input[0] !== '#') return null;
  let body = input.slice(1);
  if (body.length === 3 || body.length === 4) body = expandShortHex(body);
  if (body.length !== 6 && body.length !== 8) return null;
  const r = Number.parseInt(body.slice(0, 2), 16);
  const g = Number.parseInt(body.slice(2, 4), 16);
  const b = Number.parseInt(body.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function parseRgb(input: string): Rgb | null {
  const m = input.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i
  );
  if (!m) return null;
  return {
    r: clamp255(Number(m[1])),
    g: clamp255(Number(m[2])),
    b: clamp255(Number(m[3])),
  };
}

function hueToRgbComponent(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = clamp255(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = (((h % 360) + 360) % 360) / 360;
  return {
    r: clamp255(hueToRgbComponent(p, q, hk + 1 / 3) * 255),
    g: clamp255(hueToRgbComponent(p, q, hk) * 255),
    b: clamp255(hueToRgbComponent(p, q, hk - 1 / 3) * 255),
  };
}

function parseHsl(input: string): Rgb | null {
  const m = input.match(
    /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i
  );
  if (!m) return null;
  return hslToRgb(Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100);
}

/** Parse a CSS color string to RGB. Returns `null` for unsupported input. */
export function parseColor(input: string): Rgb | null {
  const trimmed = input.trim();
  return parseHex(trimmed) ?? parseRgb(trimmed) ?? parseHsl(trimmed);
}

function linearizeChannel(value8bit: number): number {
  const s = value8bit / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * linearizeChannel(rgb.r) +
    0.7152 * linearizeChannel(rgb.g) +
    0.0722 * linearizeChannel(rgb.b)
  );
}

/** WCAG contrast ratio between two colors (1:1 to 21:1). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Options for {@link bestOnColor}. */
export type BestOnColorOptions = {
  light?: OnColorSet;
  dark?: OnColorSet;
};

/**
 * Pick the foreground set (`ON_DARK` white family vs `ON_LIGHT` near-black
 * family) that has the higher contrast ratio against `background`. Falls back
 * to `ON_DARK` for unparseable input (most saturated brand fills are dark
 * enough that white wins).
 */
export function bestOnColor(
  background: string,
  options?: BestOnColorOptions
): OnColorSet {
  const onDark = options?.dark ?? ON_DARK;
  const onLight = options?.light ?? ON_LIGHT;
  const bg = parseColor(background);
  if (!bg) return onDark;
  const whiteRgb = parseColor(onDark.fg);
  const blackRgb = parseColor(onLight.fg);
  if (!whiteRgb || !blackRgb) return onDark;
  const whiteContrast = contrastRatio(whiteRgb, bg);
  const blackContrast = contrastRatio(blackRgb, bg);
  return whiteContrast >= blackContrast ? onDark : onLight;
}
