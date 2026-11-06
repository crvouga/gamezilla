/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import {
  MONOGRAM_PAINTS,
  MonogramTile,
  monogramOf,
  monogramPaint,
} from '@pkgs/ui-root-client-ts/monogram-tile';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared-ts/color-palette';
import { contrastRatio, parseColor } from '@pkgs/ui-root-shared-ts/contrast';
import { mustQuery, renderUi } from './render';

describe('monogramOf', () => {
  test.each([
    ['Friday game night', 'F'],
    ["robin_42's space", 'R'],
    ['  sunday  ', 'S'],
    ['@jordan', 'J'],
    ['42 club', '4'],
    ['échecs', 'É'],
    ['🎲', '🎲'],
    ['', '?'],
  ])('%p → %p', (name, mark) => {
    expect(monogramOf(name)).toBe(mark);
  });
});

describe('monogram paints', () => {
  test('the same seed always gives the same paint', () => {
    const seed = '5bace000-0000-4000-8000-000000000001';
    expect(monogramPaint(seed)).toBe(monogramPaint(seed));
  });

  test('ids that differ only at the end spread across every paint', () => {
    const seeds = Array.from(
      { length: 40 },
      (_, i) =>
        `5bace000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`
    );
    expect(new Set(seeds.map(monogramPaint)).size).toBe(MONOGRAM_PAINTS.length);
  });

  // regression: space-tile-colour-changes-with-theme
  test('a paint is the same colour in both themes, so a space keeps its colour', () => {
    const differ = MONOGRAM_PAINTS.filter(
      (paint) => COLOR_PALETTE.light[paint] !== COLOR_PALETTE.dark[paint]
    );
    expect(differ).toEqual([]);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: every paint's letter holds AA`, () => {
      const colors = COLOR_PALETTE[scheme];
      const low = MONOGRAM_PAINTS.flatMap((paint) => {
        const plate = parseColor(colors[paint]);
        const ink = parseColor(colors.onPrimary);
        if (plate === null || ink === null) return [`${paint}: unparseable`];
        const ratio = contrastRatio(ink, plate);
        return ratio >= 4.5 ? [] : [`${paint}: ${ratio.toFixed(2)}`];
      });
      expect(low).toEqual([]);
    });
  }
});

test('the tile draws the first letter, hidden from assistive tech', () => {
  renderUi(() => (
    <MonogramTile name="Friday game night" seed="space-1" size="lg" />
  ));
  const tile = mustQuery('[data-component="MonogramTile"]');
  expect(tile.textContent).toBe('F');
  expect(tile.getAttribute('aria-hidden')).toBe('true');
  expect(tile.getAttribute('data-paint')).toBe(monogramPaint('space-1'));
});
