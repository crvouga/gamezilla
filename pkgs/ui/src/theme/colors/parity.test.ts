import { describe, expect, test } from 'bun:test';
import { PALETTE } from './color-palette';
import type { ColorScheme, ColorTokens } from './types';

const SCHEMES: ReadonlyArray<ColorScheme> = ['light', 'dark'];

// All keys from `ColorTokens`. Update when adding a new color token so every
// palette is forced to provide it for both schemes.
const REQUIRED_TOKENS: ReadonlyArray<keyof ColorTokens> = [
  'background',
  'surface',
  'surfaceSunken',
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
  'tintHighlight',
  'onTint',
  'onPrimary',
  'onDestructive',
  'onSuccess',
  'onWarning',
  'onInfo',
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
];

describe('color palette parity', () => {
  for (const scheme of SCHEMES) {
    const tokens = PALETTE[scheme];

    test(`PALETTE.${scheme} provides every ColorTokens key`, () => {
      for (const key of REQUIRED_TOKENS) {
        const value = tokens[key];
        expect(value).toBeDefined();
        expect(typeof value).toBe('string');
        expect((value as string).length).toBeGreaterThan(0);
      }
    });

    test(`PALETTE.${scheme} has no extra tokens beyond ColorTokens`, () => {
      const actualKeys = Object.keys(tokens).sort();
      const expectedKeys = [...REQUIRED_TOKENS].sort();
      expect(actualKeys).toEqual(expectedKeys);
    });
  }
});
