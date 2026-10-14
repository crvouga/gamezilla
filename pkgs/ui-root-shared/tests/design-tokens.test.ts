/**
 * `design-system/design-tokens.json` is the single source of every visual
 * value. It must be a valid W3C Design Tokens tree, and the TypeScript copy,
 * `token-names.ts`, `tokens.css` and the Swift projection must be what the
 * tree renders today.
 */

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { breakpoint } from '@pkgs/ui-root-shared/breakpoints';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared/color-palette';
import { renderTokensCss } from '@pkgs/ui-root-shared/css-vars';
import { isTokenTree } from '@pkgs/ui-root-shared/design-tokens';
import {
  designTokenPaths,
  validateDesignTokens,
} from '@pkgs/ui-root-shared/design-tokens-validate';
import { fonts } from '@pkgs/ui-root-shared/fonts';
import { layer } from '@pkgs/ui-root-shared/layers';
import { duration, easing } from '@pkgs/ui-root-shared/motion';
import {
  hslToSrgb,
  renderSwiftTokens,
} from '@pkgs/ui-root-shared/render-swift-tokens';
import {
  renderTokenNamesTs,
  tokenScales,
} from '@pkgs/ui-root-shared/render-token-names';
import {
  borderRadius,
  radiusRole,
  spaceSize,
  spacing,
} from '@pkgs/ui-root-shared/scale';
import { controlSize, iconSize, maxWidth } from '@pkgs/ui-root-shared/sizes';
import {
  COLOR_TONES,
  SPACE_TOKENS,
  SURFACE_TONES,
} from '@pkgs/ui-root-shared/token-names';
import { surfaceToneColor, textToneColor } from '@pkgs/ui-root-shared/tones';

const SRC = join(import.meta.dir, '..', 'src');
const REPO = join(import.meta.dir, '..', '..', '..');
const CANONICAL = join(REPO, 'design-system', 'design-tokens.json');
const SWIFT = join(REPO, 'design-system', 'swift', 'design-tokens.swift');

async function readTokens(): Promise<unknown> {
  return JSON.parse(await Bun.file(CANONICAL).text());
}

describe('design-tokens.json', () => {
  test('is a valid W3C Design Tokens tree', async () => {
    expect(validateDesignTokens(await readTokens())).toEqual([]);
  });

  test('holds every group the design system reads', async () => {
    const paths = designTokenPaths(await readTokens());
    for (const path of [
      'color.light.background',
      'color.dark.background',
      'tone.text.secondary',
      'tone.surface.muted',
      'space.scale.4',
      'space.size.md',
      'font.family.display',
      'font.size.base',
      'font.leading.base',
      'font.lineHeight.normal',
      'font.weight.semibold',
      'radius.role.control',
      'motion.duration.fast',
      'motion.easing.standard',
      'size.icon.md',
      'size.control.md',
      'size.maxWidth.prose',
      'breakpoint.md',
      'layer.overlay',
      'opacity.muted',
    ]) {
      expect(paths).toContain(path);
    }
  });

  test('the validator rejects what the format forbids', () => {
    const issue = (tree: unknown): string =>
      validateDesignTokens(tree)
        .map((found) => `${found.path}: ${found.message}`)
        .join('; ');
    expect(issue({ a: { $value: 1 } })).toContain('no resolvable $type');
    expect(issue({ a: {} })).toContain('a leaf must have a $value');
    expect(issue({ a: { $type: 'number', $value: '{b}' } })).toContain(
      'alias {b} names no token'
    );
    expect(
      issue({
        a: { $type: 'number', $value: '{b}' },
        b: { $type: 'number', $value: '{a}' },
      })
    ).toContain('alias is circular');
    expect(
      issue({
        a: { $type: 'number', $value: '{b}' },
        b: { $type: 'dimension', $value: { value: 1, unit: 'px' } },
      })
    ).toContain('is a dimension, not a number');
    expect(
      issue({ a: { $type: 'dimension', $value: { value: 1, unit: 'em' } } })
    ).toContain('$value is not a dimension');
    expect(issue({ 'a.b': { $type: 'number', $value: 1 } })).toContain(
      'name contains'
    );
  });
});

describe('values derived from the tokens', () => {
  test('the t-shirt spacing scale sits on the 4px grid', () => {
    expect(spaceSize).toEqual({
      none: 0,
      '2xs': 2,
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      '2xl': 32,
      '3xl': 48,
    });
    expect(spacing['0-5']).toBe(2);
    expect(spacing[4]).toBe(16);
  });

  test('radius roles are the hierarchy steps', () => {
    expect(radiusRole).toEqual({
      none: borderRadius.none,
      sm: borderRadius.sm,
      control: borderRadius.md,
      card: borderRadius.lg,
      sheet: borderRadius.xl,
      full: borderRadius.full,
    });
  });

  test('sizes, breakpoints and layers read as px and plain numbers', () => {
    expect(iconSize).toEqual({
      xs: 12,
      sm: 16,
      md: 20,
      lg: 24,
      xl: 32,
      '2xl': 48,
    });
    expect(controlSize.md).toBe(48);
    expect(maxWidth.wide).toBe(1200);
    expect(breakpoint).toEqual({ sm: 640, md: 768, lg: 1024, xl: 1280 });
    expect(layer.tooltip).toBeGreaterThan(layer.overlay);
    expect(layer.overlay).toBeGreaterThan(layer.surface);
  });

  test('colors, fonts and motion render as the CSS they always were', () => {
    expect(COLOR_PALETTE.light.background).toBe('hsla(0, 0%, 100%, 1)');
    expect(COLOR_PALETTE.light.tintSubtle).toBe('hsla(204, 88%, 53%, 0.10)');
    expect(COLOR_PALETTE.dark.scrim).toBe('hsla(0, 0%, 0%, 0.72)');
    expect(fonts.display.startsWith('"Bricolage Grotesque", system-ui')).toBe(
      true
    );
    expect(duration.fast).toBe(120);
    expect(easing.standard).toBe('cubic-bezier(0.2, 0, 0, 1)');
  });

  test('every tone names a palette role', () => {
    const palette = Object.keys(COLOR_PALETTE.light);
    for (const role of [
      ...Object.values(textToneColor),
      ...Object.values(surfaceToneColor),
    ]) {
      expect(palette).toContain(role);
    }
    expect(textToneColor.secondary).toBe('textSecondary');
    expect(surfaceToneColor.muted).toBe('surfaceMuted');
  });
});

describe('generated files', () => {
  test('the TypeScript copy matches the source document', async () => {
    const source = await Bun.file(CANONICAL).text();
    const copy = await Bun.file(join(SRC, 'design-tokens.json')).text();
    expect(copy).toBe(source);
  });

  test('design-tokens.swift is what the document renders today', async () => {
    const tree = await readTokens();
    if (!isTokenTree(tree)) throw new Error('design tokens are not an object');
    const current = await Bun.file(SWIFT).text();
    expect(current).toBe(renderSwiftTokens(tree));
    expect(current).toContain('static let `default`');
    expect(current).toContain(
      'static let n0_5 = Quantity(value: 2, unit: "px")'
    );
  });

  test('hsl white, black and red become sRGB', () => {
    expect(hslToSrgb(0, 0, 100)).toEqual([1, 1, 1]);
    expect(hslToSrgb(0, 0, 0)).toEqual([0, 0, 0]);
    expect(hslToSrgb(0, 100, 50)).toEqual([1, 0, 0]);
  });

  test('token-names.ts is what the tokens render today', async () => {
    const current = await Bun.file(join(SRC, 'token-names.ts')).text();
    expect(current).toBe(renderTokenNamesTs());
  });

  test('every scale is exported under its array and its union', () => {
    const source = renderTokenNamesTs();
    for (const scale of tokenScales()) {
      expect(scale.names.length).toBeGreaterThan(0);
      expect(new Set(scale.names).size).toBe(scale.names.length);
      expect(source).toContain(`export const ${scale.list} = [`);
      expect(source).toContain(
        `export type ${scale.type} = (typeof ${scale.list})[number];`
      );
    }
    expect(Object.keys(spaceSize)).toEqual([...SPACE_TOKENS]);
    expect(COLOR_TONES.at(-1)).toBe('inherit');
    expect(SURFACE_TONES.at(-1)).toBe('transparent');
  });

  test('tokens.css carries a variable for every semantic scale name', () => {
    const css = renderTokensCss();
    expect(css.startsWith('/* GENERATED from design-system/')).toBe(true);
    for (const name of SPACE_TOKENS) {
      expect(css).toContain(`  --ui-space-${name}: ${spaceSize[name]}px;`);
    }
    expect(css).toContain('  --ui-radius-control: 12px;');
    expect(css).toContain('  --ui-max-width-prose: 640px;');
    expect(css).toContain('  --ui-layer-overlay: 1000000;');
    expect(css).toContain('  --ui-opacity-muted: 55%;');
  });
});
