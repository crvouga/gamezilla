import { hslToRgb } from '@pkgs/colors-shared/convert';
import type { Hsla, Rgb } from '@pkgs/colors-shared/types';
import { hsla } from '@pkgs/colors-shared/types';

/**
 * Fixed, colorblind-considerate hue palette for collaborative participants.
 * Saturation/lightness chosen for readable rings on both light and dark surfaces.
 */
export const PARTICIPANT_COLOR_PALETTE: readonly Hsla[] = [
  hsla(210, 0.72, 0.52, 1), // blue
  hsla(14, 0.78, 0.52, 1), // orange
  hsla(152, 0.55, 0.4, 1), // green
  hsla(330, 0.65, 0.52, 1), // magenta
  hsla(45, 0.85, 0.48, 1), // gold
  hsla(265, 0.55, 0.58, 1), // purple
  hsla(185, 0.65, 0.42, 1), // teal
  hsla(0, 0.7, 0.52, 1), // red
] as const;

export type ParticipantColor = {
  /** CSS color string for rings / borders. */
  readonly css: string;
  readonly hsla: Hsla;
  readonly rgb: Rgb;
  readonly paletteIndex: number;
};

function hashKey(key: string): number {
  // FNV-1a 32-bit — stable across JS runtimes, good enough for palette pick.
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function toCss(c: Hsla): string {
  const s = Math.round(c.s * 100);
  const l = Math.round(c.l * 100);
  if (c.a >= 1) return `hsl(${Math.round(c.h)} ${s}% ${l}%)`;
  return `hsl(${Math.round(c.h)} ${s}% ${l}% / ${c.a})`;
}

function colorAt(index: number): ParticipantColor {
  const paletteIndex =
    ((index % PARTICIPANT_COLOR_PALETTE.length) +
      PARTICIPANT_COLOR_PALETTE.length) %
    PARTICIPANT_COLOR_PALETTE.length;
  const c = PARTICIPANT_COLOR_PALETTE[paletteIndex]!;
  return {
    css: toCss(c),
    hsla: c,
    rgb: hslToRgb(c),
    paletteIndex,
  };
}

/** Deterministic color for a single participant key (ignores collisions). */
export function resolveParticipantColor(key: string): ParticipantColor {
  return colorAt(hashKey(key));
}

/**
 * Assign colors to a set of participant keys, greedily de-colliding so no two
 * keys in the same room share a palette slot when the set is smaller than the
 * palette. Keys are sorted for stable assignment across clients.
 */
export function assignParticipantColors(
  keys: readonly string[]
): ReadonlyMap<string, ParticipantColor> {
  const unique = [...new Set(keys)].sort();
  const used = new Set<number>();
  const out = new Map<string, ParticipantColor>();
  for (const key of unique) {
    const preferred = hashKey(key) % PARTICIPANT_COLOR_PALETTE.length;
    let idx = preferred;
    if (used.has(idx) && used.size < PARTICIPANT_COLOR_PALETTE.length) {
      for (let step = 1; step < PARTICIPANT_COLOR_PALETTE.length; step++) {
        const candidate = (preferred + step) % PARTICIPANT_COLOR_PALETTE.length;
        if (!used.has(candidate)) {
          idx = candidate;
          break;
        }
      }
    }
    used.add(idx);
    out.set(key, colorAt(idx));
  }
  return out;
}
