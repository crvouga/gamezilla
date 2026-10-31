import { expect, test } from 'bun:test';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared-ts/color-palette';
import type { ColorTokenName } from '@pkgs/ui-root-shared-ts/colors-types';
import { contrastRatio, parseColor } from '@pkgs/ui-root-shared-ts/contrast';

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

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme}: game canvases are distinct and their labels remain readable`, () => {
    const palette = COLOR_PALETTE[scheme];
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
}

test('the Hearts focus ring contrasts with the card face it is drawn inside', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const palette = COLOR_PALETTE[scheme];
    const ring = parseColor(palette.gameHeartsCanvas);
    const face = parseColor(palette.boardCardFace);
    if (!ring || !face) throw new Error('Invalid card palette');
    expect(contrastRatio(ring, face)).toBeGreaterThanOrEqual(3);
  }
});
