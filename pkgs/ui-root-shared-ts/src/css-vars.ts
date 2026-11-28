/** CSS properties projected from the shared design tokens. */

import { breakpoint } from './breakpoints';
import { COLOR_PALETTE } from './color-palette';
import type { ColorTokens } from './colors-types';
import {
  COLOR_TOKEN_NAMES,
  colorVar,
  kebab,
  surfaceFinishes,
} from './document-palette';
import { fonts } from './fonts';
import { layer } from './layers';
import { duration, easing } from './motion';
import type { ElevationLevel, ElevationStyle } from './scale';
import {
  borderRadius,
  fontLeading,
  fontSize,
  fontWeight,
  lineHeight,
  makeElevation,
  opacity,
  radiusRole,
  spaceRole,
  spaceSize,
  spacing,
} from './scale';
import { shadowCss } from './shadows';
import { controlSize, iconSize, maxWidth } from './sizes';
import { textStyleCssLines } from './typography';

/** Palette-shaped map whose values are CSS variable references. */
export const CSS_VAR_COLORS: ColorTokens = Object.fromEntries(
  COLOR_TOKEN_NAMES.map((name) => [name, colorVar(name)])
) as ColorTokens;

const ELEVATION_LEVELS: readonly ElevationLevel[] = [1, 2, 3, 4, 5];

export function cssVarElevation(level: ElevationLevel): ElevationStyle {
  if (level === 0) return {};
  return { backgroundColor: `var(--ui-elevation-${level})` };
}

function paletteLines(): string[] {
  const elevation = makeElevation(COLOR_PALETTE);
  const lines = ['  color-scheme: dark;'];
  for (const name of COLOR_TOKEN_NAMES) {
    lines.push(`  --ui-color-${kebab(name)}: ${COLOR_PALETTE[name]};`);
  }
  for (const [name, value] of Object.entries(surfaceFinishes)) {
    lines.push(`  --ui-finish-${name}: ${value};`);
  }
  for (const level of ELEVATION_LEVELS) {
    lines.push(
      `  --ui-elevation-${level}: ${elevation(level).backgroundColor};`
    );
  }
  for (const [name, value] of Object.entries(shadowCss)) {
    lines.push(`  --ui-shadow-${name}: ${value};`);
  }
  // Default on-color cascade for icons/text outside an OnColorProvider.
  lines.push('  --ui-on-fg: var(--ui-color-text);');
  lines.push('  --ui-on-fg-muted: var(--ui-color-text-secondary);');
  lines.push('  --ui-on-icon: var(--ui-color-icon);');
  return lines;
}

function rootBlock(): string {
  const lines = paletteLines();
  for (const [key, value] of Object.entries(spacing)) {
    lines.push(`  --ui-space-${key.replace('.', '-')}: ${value}px;`);
  }
  for (const [key, value] of Object.entries(spaceRole)) {
    lines.push(`  --ui-space-${key}: ${value}px;`);
  }
  for (const [key, value] of Object.entries(fonts)) {
    lines.push(`  --ui-font-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(fontSize)) {
    lines.push(`  --ui-font-size-${key}: ${value}px;`);
  }
  for (const [key, value] of Object.entries(fontLeading)) {
    lines.push(`  --ui-leading-${key}: ${value}px;`);
  }
  for (const [key, value] of Object.entries(lineHeight)) {
    lines.push(`  --ui-line-height-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(borderRadius)) {
    lines.push(`  --ui-radius-${key}: ${value}px;`);
  }
  for (const [key, value] of Object.entries(duration)) {
    lines.push(`  --ui-duration-${key}: ${value}ms;`);
  }
  for (const [key, value] of Object.entries(easing)) {
    lines.push(`  --ui-easing-${key}: ${value};`);
  }
  lines.push(...semanticScaleLines());
  lines.push(...textStyleCssLines());
  return `:root {\n${lines.join('\n')}\n}`;
}

/** `55%` for the fraction `0.55`, without binary-float noise. */
function percent(fraction: number): string {
  return `${Math.round(fraction * 1000) / 10}%`;
}

/**
 * The scales `token-names.ts` names (`SpaceToken`, `RadiusToken`, …), after
 * the raw scales so every older variable keeps its line.
 */
function semanticScaleLines(): string[] {
  const px = (prefix: string, scale: Readonly<Record<string, number>>) =>
    Object.entries(scale).map(
      ([key, value]) => `  --ui-${prefix}-${key}: ${value}px;`
    );
  // `none`, `sm` and `full` are already the raw steps of the same name.
  const rawRadii = new Set(Object.keys(borderRadius));
  const namedRadii = Object.fromEntries(
    Object.entries(radiusRole).filter(([key]) => !rawRadii.has(key))
  );
  return [
    ...px('space', spaceSize),
    ...px('radius', namedRadii),
    ...Object.entries(fontWeight).map(
      ([key, value]) => `  --ui-font-weight-${key}: ${value};`
    ),
    ...px('icon-size', iconSize),
    ...px('control-size', controlSize),
    ...px('max-width', maxWidth),
    ...px('breakpoint', breakpoint),
    ...Object.entries(layer).map(
      ([key, value]) => `  --ui-layer-${key}: ${value};`
    ),
    ...Object.entries(opacity).map(
      ([key, value]) => `  --ui-opacity-${key}: ${percent(value)};`
    ),
  ];
}

/** Full contents of `tokens.css`. Pure; the generator script writes it. */
export function renderTokensCss(): string {
  return (
    [
      '/* GENERATED from pkgs/ui-root-shared-ts/src/design-tokens.json — do not edit. */',
      rootBlock(),
    ].join('\n\n') + '\n'
  );
}
