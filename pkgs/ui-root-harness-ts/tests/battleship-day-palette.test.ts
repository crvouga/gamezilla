/** Battleship's waters take the page's light: a day sea in the light theme. */
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Theme = Readonly<Record<string, { $value: { hex: string } }>>;

const tokens = JSON.parse(
  readFileSync(
    join(import.meta.dirname, '../../ui-root-shared-ts/src/design-tokens.json'),
    'utf8'
  )
) as { color: { light: Theme; dark: Theme } };

function hex(theme: Theme, name: string): string {
  const token = theme[name];
  if (token === undefined) throw new Error(`no token ${name}`);
  return token.$value.hex;
}

/** WCAG relative luminance of `#rrggbb`. */
function luminance(color: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const c = Number.parseInt(color.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

// regression: battleship-board-dark-in-light-theme — in the light theme the
// Battleship grid stayed a dark navy slab that outweighed the white page.
// The light theme has its own day palette: pale water and frame, dark ink,
// every mark still readable on the cells it sits on.
test('the light theme draws Battleship as a day sea, every mark readable', () => {
  const light = tokens.color.light;
  const dark = tokens.color.dark;
  const canvas = hex(light, 'gameBattleshipCanvas');
  const surface = hex(light, 'gameBattleshipSurface');
  expect(canvas).not.toBe(hex(dark, 'gameBattleshipCanvas'));
  expect(luminance(canvas)).toBeGreaterThan(0.8);
  expect(luminance(surface)).toBeGreaterThan(0.6);
  // Ink (a sunk ship's ring, the shot just fired) on the water.
  expect(contrast(hex(light, 'gameBattleshipInk'), canvas)).toBeGreaterThan(7);
  // The grid's A–J and 1–10 on its frame.
  expect(
    contrast(hex(light, 'gameBattleshipMuted'), surface)
  ).toBeGreaterThanOrEqual(4.5);
  // A hit's mark on the water, and the focus ring.
  expect(contrast(hex(light, 'gameBattleshipOne'), canvas)).toBeGreaterThan(
    4.5
  );
  expect(
    contrast(hex(light, 'gameBattleshipAccent'), canvas)
  ).toBeGreaterThanOrEqual(4.5);
});
