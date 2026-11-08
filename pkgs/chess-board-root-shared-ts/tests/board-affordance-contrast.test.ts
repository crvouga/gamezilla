import { expect, test } from 'bun:test';
import {
  defaultBoardTheme,
  mergeBoardTheme,
} from '@pkgs/chess-board-root-shared-ts/board-theme';
import { compositeOver, contrastRatio } from '@pkgs/ui-root-shared-ts/contrast';
import { parseCssColor, rgbaToRgb8 } from '@pkgs/ui-root-shared-ts/css-color';

function paintedContrast(ink: string, surface: string): number {
  const foreground = parseCssColor(ink);
  const background = parseCssColor(surface);
  if (!foreground || !background) throw new Error('Unresolved test palette');
  return contrastRatio(
    rgbaToRgb8(compositeOver(foreground, background)),
    rgbaToRgb8(background)
  );
}

// regression: chess-promotion-cancel-low-contrast
test('Cancel on the walnut promotion chip meets normal-text contrast in both app themes', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const { promotion } = defaultBoardTheme(scheme);
    expect(promotion.cancel).toBe('#b58863');
    expect(
      paintedContrast(promotion.ink, promotion.cancel)
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test('promotion cancellation derives readable ink after a square palette override', () => {
  for (const darkSquare of ['#222222', '#eeeeee']) {
    const { promotion } = mergeBoardTheme(defaultBoardTheme('light'), {
      darkSquare,
    });
    expect(
      paintedContrast(promotion.ink, promotion.cancel)
    ).toBeGreaterThanOrEqual(4.5);
  }
});

// regression: chess-legal-target-low-contrast
test('legal move dots and capture rings separate from both wooden square colors', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const theme = defaultBoardTheme(scheme);
    for (const ink of [theme.legalMoveDot, theme.legalMoveCaptureRing]) {
      for (const surface of [theme.lightSquare, theme.darkSquare]) {
        expect(paintedContrast(ink, surface)).toBeGreaterThanOrEqual(3);
      }
    }
  }
});
