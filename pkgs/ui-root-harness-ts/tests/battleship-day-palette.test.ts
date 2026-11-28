import { expect, test } from 'bun:test';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared-ts/color-palette';
import type { ColorTokenName } from '@pkgs/ui-root-shared-ts/colors-types';
import { contrastRatio, parseColor } from '@pkgs/ui-root-shared-ts/contrast';

function contrast(a: ColorTokenName, b: ColorTokenName): number {
  const front = parseColor(COLOR_PALETTE[a]);
  const back = parseColor(COLOR_PALETTE[b]);
  if (!front || !back) throw new Error(`Invalid Battleship colors: ${a}, ${b}`);
  return contrastRatio(front, back);
}

// regression: battleship-board-dark-in-light-theme
test('ship outlines, hits, focus and coordinates remain readable', () => {
  expect(contrast('gameBattleshipInk', 'gameBattleshipCanvas')).toBeGreaterThan(
    7
  );
  expect(
    contrast('gameBattleshipOne', 'gameBattleshipCanvas')
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    contrast('gameBattleshipAccent', 'gameBattleshipCanvas')
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    contrast('gameBattleshipMuted', 'gameBattleshipSurface')
  ).toBeGreaterThanOrEqual(4.5);
});

// regression: battleship-day-grid-washed-out
test('targets separate from the frame and its coordinates', () => {
  expect(
    contrast('gameBattleshipCanvas', 'gameBattleshipSurface')
  ).toBeGreaterThanOrEqual(1.55);
  expect(
    contrast('gameBattleshipInk', 'gameBattleshipSurface')
  ).toBeGreaterThan(7);
});
