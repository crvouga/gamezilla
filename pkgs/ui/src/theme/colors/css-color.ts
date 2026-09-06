/**
 * CSS color string ↔ {@link @pkgs/colors} typed values.
 *
 * This is the only layer that speaks hex / `rgb()` / `hsl()` syntax.
 * Color math lives in `@pkgs/colors`.
 */

import {
  clamp01,
  type Hsla,
  hslaToRgba,
  type Rgba,
  rgba,
  rgbaToHsla,
} from '@pkgs/colors';

function expandShortHex(hex: string): string {
  let out = '';
  for (const ch of hex) out += ch + ch;
  return out;
}

function parseHexByte(hex: string, start: number): number | null {
  const value = Number.parseInt(hex.slice(start, start + 2), 16);
  return Number.isNaN(value) ? null : value;
}

function normalizeHexBody(input: string): string | null {
  if (!input.startsWith('#')) return null;
  let body = input.slice(1);
  if (body.length === 3 || body.length === 4) body = expandShortHex(body);
  if (body.length !== 6 && body.length !== 8) return null;
  return body;
}

function parseHex(input: string): Rgba | null {
  const body = normalizeHexBody(input);
  if (body === null) return null;
  const r = parseHexByte(body, 0);
  const g = parseHexByte(body, 2);
  const b = parseHexByte(body, 4);
  if (r === null || g === null || b === null) return null;
  if (body.length === 6) return rgba(r / 255, g / 255, b / 255, 1);
  const aByte = parseHexByte(body, 6);
  if (aByte === null) return null;
  return rgba(r / 255, g / 255, b / 255, aByte / 255);
}

function parseRgb(input: string): Rgba | null {
  const m =
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+)\s*)?\)/i.exec(
      input
    );
  if (!m) return null;
  const a = m[4] !== undefined ? Number(m[4]) : 1;
  return rgba(Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, a);
}

function parseHsl(input: string): Rgba | null {
  const m =
    /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+)\s*)?\)/i.exec(
      input
    );
  if (!m) return null;
  const a = m[4] !== undefined ? Number(m[4]) : 1;
  return hslaToRgba({
    h: Number(m[1]),
    s: Number(m[2]) / 100,
    l: Number(m[3]) / 100,
    a: clamp01(a),
  });
}

/** Parse a CSS color string to typed RGBA (`[0, 1]` channels). */
export function parseCssColor(input: string): Rgba | null {
  const trimmed = input.trim();
  return parseHex(trimmed) ?? parseRgb(trimmed) ?? parseHsl(trimmed);
}

function formatNumber(n: number, digits: number): string {
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

/** Format a typed color as palette-style `hsla(h, s%, l%, a)`. */
export function formatCssHsla(color: Rgba | Hsla): string {
  const hsla =
    'r' in color ? rgbaToHsla(color) : { ...color, a: clamp01(color.a) };
  const h = formatNumber(hsla.h, 2);
  const s = formatNumber(hsla.s * 100, 2);
  const l = formatNumber(hsla.l * 100, 2);
  const a = formatNumber(hsla.a, 4);
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

/** 0–255 integer RGB used by legacy UI contrast helpers. */
export type CssRgb8 = { r: number; g: number; b: number };

export function rgbaToRgb8(c: Rgba): CssRgb8 {
  return {
    r: Math.round(clamp01(c.r) * 255),
    g: Math.round(clamp01(c.g) * 255),
    b: Math.round(clamp01(c.b) * 255),
  };
}

export function rgb8ToRgba(c: CssRgb8, a = 1): Rgba {
  return rgba(c.r / 255, c.g / 255, c.b / 255, a);
}
