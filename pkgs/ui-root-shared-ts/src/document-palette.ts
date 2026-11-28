import { COLOR_PALETTE } from './color-palette.ts';
import type { ColorTokenName } from './colors-types';

import { documentMetrics } from './document-metrics.ts';
import { renderDepths } from './shadows.ts';

export const COLOR_TOKEN_NAMES = Object.keys(COLOR_PALETTE) as ColorTokenName[];

export function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

export function colorVar(name: ColorTokenName): string {
  return `var(--ui-color-${kebab(name)})`;
}

/** Called at build time by the stylesheet and first-paint generators. */
export function materialVariables() {
  // Faces share an upper-left light. Sockets reverse the direction of the shading.
  const direction = 'to bottom right';
  const lit = colorVar('materialGlint');
  const shade = colorVar('actionShade');
  const finishes = {
    canvas: `linear-gradient(${direction}, ${colorVar('surfaceElevated')}, ${colorVar('surface')} 30%, ${colorVar('background')} 76%)`,
    surface: `linear-gradient(${direction}, ${colorVar('surfaceOverlay')}, ${colorVar('surfaceElevated')} 26%, ${colorVar('surface')} 88%)`,
    well: `linear-gradient(${direction}, ${colorVar('surfaceMuted')}, ${colorVar('background')} 68%, ${colorVar('surface')})`,
    action: `linear-gradient(${direction}, ${lit}, transparent 42%, ${shade} 94%)`,
    piece: `radial-gradient(ellipse at 28% 18%, ${colorVar('interactiveHover')}, transparent 54%), linear-gradient(${direction}, transparent 46%, ${shade})`,
    slot: `linear-gradient(${direction}, ${shade}, transparent 60%, ${colorVar('interactiveHover')})`,
  };

  return [
    ...Object.entries(finishes).map(
      ([name, value]) => [`--ui-finish-${name}`, value] as const
    ),
    ...Object.entries(renderDepths()).map(
      ([name, value]) => [`--ui-depth-${name}`, value] as const
    ),
  ];
}

/** Inline just the materials, palette colors and metrics used by the opening document. */
export function withDocumentPalette(css: string): string {
  const materials = materialVariables()
    .filter(([name]) => css.includes(`var(${name})`))
    .map(([name, value]) => `${name}:${value}`);
  const needed = [css, ...materials].join('');
  const colors = COLOR_TOKEN_NAMES.filter((name) =>
    needed.includes(colorVar(name))
  ).map((name) => `--ui-color-${kebab(name)}:${COLOR_PALETTE[name]}`);
  return `:root{color-scheme:dark;${[...colors, ...materials].join(';')}}\n${documentMetrics(css)}\n${css}`;
}
