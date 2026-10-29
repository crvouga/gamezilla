/**
 * The eight text styles of `design-tokens.json` (`typography`), each a face,
 * a size, a weight and a line height read through their aliases. A text
 * component names a style (`TextStyle` in `token-names.ts`); `tokens.css`
 * emits each as `--ui-text-<style>-{family,size,weight,leading}`.
 */

import { aliasPath, isTokenTree, tokenNames } from './design-tokens';
import { typography } from './design-tokens.json';

/** The token each part of a style names: `font.size.3xl` → `3xl`. */
export type TypographyParts = {
  readonly family: string;
  readonly size: string;
  readonly weight: string;
  readonly leading: string;
};

function target(value: unknown, part: string, style: string): string {
  const name = aliasPath(value)?.split('.').at(-1);
  if (name === undefined) {
    throw new Error(`typography ${style}.${part} is not an alias`);
  }
  return name;
}

function readStyle(style: string): TypographyParts {
  const token: unknown = (typography as Record<string, unknown>)[style];
  const value = isTokenTree(token) ? token['$value'] : undefined;
  if (!isTokenTree(value)) throw new Error(`typography ${style} has no value`);
  return {
    family: target(value['fontFamily'], 'fontFamily', style),
    size: target(value['fontSize'], 'fontSize', style),
    weight: target(value['fontWeight'], 'fontWeight', style),
    leading: target(value['lineHeight'], 'lineHeight', style),
  };
}

/** Style names in source order: `display-xl` … `label`. */
export const textStyleNames: readonly string[] = tokenNames(typography);

/** Every style's parts, keyed by style name. */
export const textStyles: Readonly<Record<string, TypographyParts>> =
  Object.fromEntries(textStyleNames.map((name) => [name, readStyle(name)]));

/** The `--ui-text-<style>-*` declarations `tokens.css` carries. */
export function textStyleCssLines(): string[] {
  return Object.entries(textStyles).flatMap(([name, parts]) => [
    `  --ui-text-${name}-family: var(--ui-font-${parts.family});`,
    `  --ui-text-${name}-size: var(--ui-font-size-${parts.size});`,
    `  --ui-text-${name}-weight: var(--ui-font-weight-${parts.weight});`,
    `  --ui-text-${name}-leading: var(--ui-leading-${parts.leading});`,
  ]);
}
