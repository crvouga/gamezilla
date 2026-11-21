import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GAME_SEAT_PAWN_INKS } from '@pkgs/ui-root-client-ts/game-seat-swatch';

const repo = join(import.meta.dir, '../../..');
const read = (path: string) => readFileSync(join(repo, path), 'utf8');

type Color = { readonly $value: { readonly hex: string } };
const tokens = JSON.parse(
  read('pkgs/ui-root-shared-ts/src/design-tokens.json')
) as { color: Record<'light' | 'dark', Record<string, Color>> };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** `text-game-quoridor-one` → `gameQuoridorOne`, the token it reads. */
function token(utility: string): string {
  return utility
    .replace(/^(bg|text)-/, '')
    .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

// regression: seat-chip-ink-differs-from-pawn
test('a pawn seat chip draws its mark in the pawn ink on the board square, readable in both themes', () => {
  const swatch = read('pkgs/ui-root-client-ts/src/game-seat-swatch/index.tsx');
  for (const [paint, ink] of Object.entries(GAME_SEAT_PAWN_INKS)) {
    const ground = new RegExp(`'${paint}': '(bg-[a-z-]+)'`).exec(swatch)?.[1];
    expect(ground).toBe('bg-game-quoridor-surface');
    for (const theme of ['light', 'dark'] as const) {
      const hex = (utility: string) =>
        tokens.color[theme][token(utility)]?.$value.hex ?? '';
      expect(hex(ink)).toMatch(/^#[0-9a-f]{6}$/);
      expect(
        contrast(hex(ink), hex(ground ?? '')),
        `${paint} in ${theme}`
      ).toBeGreaterThanOrEqual(3);
    }
  }
});
