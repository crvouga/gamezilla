import { COLOR_PALETTE } from './color-palette.ts';
import type { ColorTokenName } from './colors-types';
import { documentMetrics } from './document-metrics.ts';

export const COLOR_TOKEN_NAMES = Object.keys(
  COLOR_PALETTE.light
) as ColorTokenName[];

export function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

/** `var(--ui-color-<token>)` for a palette token. */
export function colorVar(name: ColorTokenName): string {
  return `var(--ui-color-${kebab(name)})`;
}

/** Inline just the palette variables used by a document's first-paint CSS. */
export function withDocumentPalette(css: string): string {
  const names = COLOR_TOKEN_NAMES.filter((name) =>
    css.includes(colorVar(name))
  );
  const schemes = (['dark', 'light'] as const).map((scheme) => {
    const declarations = names.map(
      (name) => `--ui-color-${kebab(name)}:${COLOR_PALETTE[scheme][name]}`
    );
    return `html[data-theme="${scheme}"]{${declarations.join(';')}}`;
  });
  return [...schemes, documentMetrics(css), css].join('\n');
}
