import { COLOR_PALETTE } from './color-palette.ts';
import type { ColorTokenName } from './colors-types';

export const COLOR_TOKEN_NAMES = Object.keys(COLOR_PALETTE) as ColorTokenName[];

export function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

export function colorVar(name: ColorTokenName): string {
  return `var(--ui-color-${kebab(name)})`;
}

/** Shared by the document's opening paint and the mounted components. */
export const surfaceFinishes = {
  canvas: `linear-gradient(180deg, ${colorVar('surface')}, ${colorVar('background')})`,
  surface: `linear-gradient(180deg, ${colorVar('surfaceElevated')}, ${colorVar('surface')})`,
  well: `linear-gradient(180deg, ${colorVar('surfaceMuted')}, ${colorVar('background')})`,
  action: `linear-gradient(180deg, transparent, ${colorVar('actionShade')})`,
};

/** Inline only the opening document's finishes and the palette colors they use. */
export function withDocumentPalette(css: string): string {
  const finishes = Object.entries(surfaceFinishes)
    .filter(([name]) => css.includes(`var(--ui-finish-${name})`))
    .map(([name, value]) => `--ui-finish-${name}:${value}`);
  const needed = [css, ...finishes].join('');
  const colors = COLOR_TOKEN_NAMES.filter((name) =>
    needed.includes(colorVar(name))
  ).map((name) => `--ui-color-${kebab(name)}:${COLOR_PALETTE[name]}`);
  return `:root{color-scheme:dark;${[...colors, ...finishes].join(';')}}\n${css}`;
}
