import { expect, test } from 'bun:test';
import {
  boardThemeToCssVars,
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

// regression: chess-corner-coordinates-low-contrast
test('corner coordinates meet normal-text contrast on the square under them', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const theme = defaultBoardTheme(scheme);
    const vars = boardThemeToCssVars(theme);
    const onLight = vars['--chess-coord-on-light'];
    const onDark = vars['--chess-coord-on-dark'];
    if (!onLight || !onDark) throw new Error('Missing coordinate inks');
    expect(paintedContrast(onLight, theme.lightSquare)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(paintedContrast(onDark, theme.darkSquare)).toBeGreaterThanOrEqual(
      4.5
    );
  }
});

// regression: chess-focus-ring-low-contrast-on-walnut
test('the keyboard focus ring has a band that clears 3:1 on both squares in both themes', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const theme = defaultBoardTheme(scheme);
    const band = boardThemeToCssVars(theme)['--chess-focus-band'];
    if (!band) throw new Error('Missing focus band ink');
    for (const square of [theme.lightSquare, theme.darkSquare])
      expect(paintedContrast(band, square)).toBeGreaterThanOrEqual(3);
  }
});

test('the focus band stays readable after a square palette override', () => {
  for (const lightSquare of ['#ffffff', '#202020']) {
    const theme = mergeBoardTheme(defaultBoardTheme('dark'), { lightSquare });
    const band = boardThemeToCssVars(theme)['--chess-focus-band'];
    if (!band) throw new Error('Missing focus band ink');
    expect(paintedContrast(band, theme.lightSquare)).toBeGreaterThanOrEqual(3);
  }
});
