import { describe, expect, test } from 'bun:test';
import { BLUE } from './color-palette-blue';
import { BRUTALISM } from './color-palette-brutalism';
import { CLAUDE } from './color-palette-claude';
import { PURPLE } from './color-palette-purple';
import type { ColorPalette, ColorScheme, ColorTokens } from './types';

const PALETTES: ReadonlyArray<readonly [string, ColorPalette]> = [
  ['BLUE', BLUE],
  ['PURPLE', PURPLE],
  ['BRUTALISM', BRUTALISM],
  ['CLAUDE', CLAUDE],
];

const SCHEMES: ReadonlyArray<ColorScheme> = ['light', 'dark'];

// All keys from `ColorTokens`. Update when adding a new color token so every
// palette is forced to provide it for both schemes.
const REQUIRED_TOKENS: ReadonlyArray<keyof ColorTokens> = [
  'background',
  'surface',
  'surfaceMuted',
  'surfaceElevated',
  'surfaceOverlay',
  'text',
  'textSecondary',
  'icon',
  'tint',
  'tintHover',
  'tintActive',
  'tintSubtle',
  'tintMuted',
  'onTint',
  'interactiveHover',
  'interactivePress',
  'border',
  'outline',
  'focusRing',
  'tabIconDefault',
  'tabIconSelected',
  'destructive',
  'destructiveSurface',
  'success',
  'successSurface',
  'warning',
  'warningSurface',
  'info',
  'infoSurface',
  'disabled',
  'scrim',
  'shadowColor',
  'gradientPrimaryStart',
  'gradientPrimaryEnd',
  'gradientDangerStart',
  'gradientDangerEnd',
  'gradientNeutralStart',
  'gradientNeutralEnd',
];

describe('color palette parity', () => {
  for (const [paletteName, palette] of PALETTES) {
    for (const scheme of SCHEMES) {
      const tokens = palette[scheme];
      test(`${paletteName}.${scheme} provides every ColorTokens key`, () => {
        for (const key of REQUIRED_TOKENS) {
          const value = tokens[key];
          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
          expect((value as string).length).toBeGreaterThan(0);
        }
      });

      test(`${paletteName}.${scheme} has no extra tokens beyond ColorTokens`, () => {
        const actualKeys = Object.keys(tokens).sort();
        const expectedKeys = [...REQUIRED_TOKENS].sort();
        expect(actualKeys).toEqual(expectedKeys);
      });
    }
  }
});
