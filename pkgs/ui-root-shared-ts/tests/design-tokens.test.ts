/**
 * The package's `src/design-tokens.json` is the source of every visual value.
 * It must be a valid W3C Design Tokens tree, and `token-names.ts` and
 * `tokens.css` must be what the tree renders today.
 */

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { breakpoint } from '@pkgs/ui-root-shared-ts/breakpoints';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared-ts/color-palette';
import { renderTokensCss } from '@pkgs/ui-root-shared-ts/css-vars';
import {
  designTokenPaths,
  validateDesignTokens,
} from '@pkgs/ui-root-shared-ts/design-tokens-validate';
import { fonts } from '@pkgs/ui-root-shared-ts/fonts';
import { layer } from '@pkgs/ui-root-shared-ts/layers';
import { duration, easing } from '@pkgs/ui-root-shared-ts/motion';
import {
  renderTokenNamesTs,
  tokenScales,
} from '@pkgs/ui-root-shared-ts/render-token-names';
import {
  borderRadius,
  fontLeading,
  fontSize,
  fontWeight,
  radiusRole,
  spaceSize,
  spacing,
} from '@pkgs/ui-root-shared-ts/scale';
import { controlSize, iconSize, maxWidth } from '@pkgs/ui-root-shared-ts/sizes';
import {
  COLOR_TONES,
  SPACE_TOKENS,
  SURFACE_TONES,
  TEXT_STYLES,
} from '@pkgs/ui-root-shared-ts/token-names';
import { surfaceToneColor, textToneColor } from '@pkgs/ui-root-shared-ts/tones';
import { textStyles } from '@pkgs/ui-root-shared-ts/typography';

const SRC = join(import.meta.dir, '..', 'src');
const CANONICAL = join(SRC, 'design-tokens.json');

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
      'shadow.float',
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
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      '2xl': 32,
      '3xl': 48,
    });
    expect(Object.values(spacing).every((px) => px % 4 === 0)).toBe(true);
    expect(spacing[4]).toBe(16);
  });

  test('the type scale is 12, 13, 15, 18, 20, 26, 40 with its leading', () => {
    expect(Object.values(fontSize)).toEqual([12, 13, 15, 18, 20, 26, 40]);
    expect(Object.values(fontLeading)).toEqual([16, 18, 22, 24, 24, 30, 44]);
    expect(Object.values(fontWeight)).toEqual([400, 500, 600, 700]);
  });

  test('the text styles are the eight of the design', () => {
    expect(textStyles).toEqual({
      'display-xl': {
        family: 'display',
        size: '3xl',
        weight: 'bold',
        leading: '3xl',
      },
      display: {
        family: 'display',
        size: '2xl',
        weight: 'bold',
        leading: '2xl',
      },
      stat: {
        family: 'display',
        size: 'xl',
        weight: 'semibold',
        leading: 'xl',
      },
      title: { family: 'sans', size: 'lg', weight: 'bold', leading: 'lg' },
      body: {
        family: 'sans',
        size: 'base',
        weight: 'regular',
        leading: 'base',
      },
      'body-strong': {
        family: 'sans',
        size: 'base',
        weight: 'bold',
        leading: 'base',
      },
      caption: { family: 'sans', size: 'sm', weight: 'medium', leading: 'sm' },
      label: { family: 'sans', size: 'xs', weight: 'bold', leading: 'xs' },
    });
    expect(Object.keys(textStyles)).toEqual([...TEXT_STYLES]);
  });

  test('radii are 6, 12, 20 and round', () => {
    expect(borderRadius).toEqual({
      none: 0,
      sm: 6,
      md: 12,
      lg: 20,
      full: 9999,
    });
  });

  test('motion stays between 150 and 250ms', () => {
    expect(duration).toEqual({ instant: 0, fast: 150, normal: 200, slow: 250 });
  });

  test('radius roles are the hierarchy steps', () => {
    expect(radiusRole).toEqual({
      none: borderRadius.none,
      sm: borderRadius.sm,
      control: borderRadius.md,
      card: borderRadius.md,
      sheet: borderRadius.lg,
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
    expect(controlSize.md).toBe(44);
    expect(maxWidth.wide).toBe(1200);
    expect(breakpoint).toEqual({ sm: 640, md: 768, lg: 1024, xl: 1280 });
    expect(layer.tooltip).toBeGreaterThan(layer.overlay);
    expect(layer.overlay).toBeGreaterThan(layer.surface);
  });

  test('colors, fonts and motion render as the CSS of the design', () => {
    expect(COLOR_PALETTE.dark.background).toBe('#111111');
    expect(COLOR_PALETTE.dark.tintActive).toBe('#dedede');
    expect(COLOR_PALETTE.light.tintSubtle).toBe('#e8e8e8');
    expect(COLOR_PALETTE.dark.scrim).toBe('#000000aa');
    expect(fonts.sans.startsWith('Manrope,')).toBe(true);
    expect(fonts.display.startsWith('Unbounded,')).toBe(true);
    expect(duration.fast).toBe(150);
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
    expect(
      css.startsWith(
        '/* GENERATED from pkgs/ui-root-shared-ts/src/design-tokens.json'
      )
    ).toBe(true);
    for (const name of SPACE_TOKENS) {
      expect(css).toContain(`  --ui-space-${name}: ${spaceSize[name]}px;`);
    }
    expect(css).toContain('  --ui-radius-control: 12px;');
    for (const name of TEXT_STYLES) {
      expect(css).toContain(`  --ui-text-${name}-size: var(--ui-font-size-`);
    }
    expect(css).toContain(
      '  --ui-shadow-float: 0px 4px 16px 0px var(--ui-color-shadow-color);'
    );
    expect(css).toContain('  --ui-max-width-prose: 640px;');
    expect(css).toContain('  --ui-layer-overlay: 1000000;');
    expect(css).toContain('  --ui-opacity-muted: 55%;');
  });
});
