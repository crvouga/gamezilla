import { expect, test } from 'bun:test';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared-ts/color-palette';
import type { ColorTokenName } from '@pkgs/ui-root-shared-ts/colors-types';
import {
  compositeOver,
  contrastRatio,
  parseColor,
} from '@pkgs/ui-root-shared-ts/contrast';

import { parseCssColor, rgbaToRgb8 } from '@pkgs/ui-root-shared-ts/css-color';

const GAMES = [
  'ConnectFour',
  'Battleship',
  'Quoridor',
  'Sokoban',
  'Numberlink',
  'WordTiles',
  'Hearts',
  'Pong',
  'LightCycles',
] as const;

test(`game canvases are distinct and their labels remain readable`, () => {
  const palette = COLOR_PALETTE;
  const canvases = new Set<string>();
  for (const game of GAMES) {
    const canvas = palette[`game${game}Canvas`];
    canvases.add(canvas);
    for (const [role, minimum] of [
      ['Ink', 4.5],
      ['Muted', 4.5],
      ['Accent', 3],
    ] as const) {
      const name = `game${game}${role}` as ColorTokenName;
      const foreground = parseColor(palette[name]);
      const background = parseColor(canvas);
      if (!foreground || !background)
        throw new Error(`Invalid palette: ${game}`);
      expect(
        contrastRatio(foreground, background),
        `${game}: ${role}`
      ).toBeGreaterThanOrEqual(minimum);
    }
  }
  expect(canvases.size).toBe(GAMES.length);
});

test('the Hearts focus ring contrasts with the card face it is drawn inside', () => {
  const palette = COLOR_PALETTE;
  const ring = parseColor(palette.gameHeartsCanvas);
  const face = parseColor(palette.boardCardFace);
  if (!ring || !face) throw new Error('Invalid card palette');
  expect(contrastRatio(ring, face)).toBeGreaterThanOrEqual(3);
});

test('neutral highlights and shade preserve the marks on game pieces and slots', () => {
  for (const [ink, base] of [
    ['gameConnectFourInk', 'gameConnectFourOne'],
    ['gameConnectFourCanvas', 'gameConnectFourTwo'],
    ['boardCardInk', 'boardCardFace'],
    ['gameBattleshipMuted', 'gameBattleshipCanvas'],
  ] as const) {
    const foreground = parseColor(COLOR_PALETTE[ink]);
    const substrate = parseCssColor(COLOR_PALETTE[base]);
    if (!foreground || !substrate) throw new Error(`Invalid ${ink} on ${base}`);
    for (const end of ['interactiveHover', 'actionShade'] as const) {
      const light = parseCssColor(COLOR_PALETTE[end]);
      if (!light) throw new Error(`Invalid material color: ${end}`);
      const face = rgbaToRgb8(compositeOver(light, substrate));
      expect(
        contrastRatio(foreground, face),
        `${ink} on ${base} at ${end}`
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
});
