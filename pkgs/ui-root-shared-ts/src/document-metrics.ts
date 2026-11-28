import tokens from './design-tokens.json' with { type: 'json' };
import {
  readFontStack,
  readGroup,
  readPx,
  resolveTokenValue,
} from './design-tokens.ts';

/** Resolve first-paint metrics and their aliases from the same tokens as the app. */
export function documentMetrics(css: string): string {
  const groups = [
    ['font', readGroup(tokens, tokens.font.family, readFontStack)],
    [
      'font-size',
      readGroup(tokens, tokens.font.size, (value) => `${readPx(value)}px`),
    ],
    [
      'leading',
      readGroup(tokens, tokens.font.leading, (value) => `${readPx(value)}px`),
    ],
    [
      'radius',
      readGroup(tokens, tokens.radius.role, (value) => `${readPx(value)}px`),
    ],
  ] as const;
  const declarations = groups.flatMap(([prefix, values]) =>
    Object.entries(values).map(
      ([key, value]) => `--ui-${prefix}-${key}:${value}`
    )
  );
  for (const [name, style] of Object.entries(tokens.typography)) {
    if (typeof style !== 'object' || !('$value' in style)) continue;
    const value = style.$value;
    declarations.push(
      `--ui-text-${name}-size:${readPx(resolveTokenValue(tokens, value.fontSize))}px`,
      `--ui-text-${name}-leading:${readPx(resolveTokenValue(tokens, value.lineHeight))}px`
    );
  }
  const selected = new Set<string>();
  const include = (source: string): void => {
    for (const declaration of declarations) {
      const name = declaration.slice(0, declaration.indexOf(':'));
      if (selected.has(declaration) || !source.includes(`var(${name}`))
        continue;
      selected.add(declaration);
      include(declaration.slice(declaration.indexOf(':') + 1));
    }
  };
  include(css);
  return `:root{${[...selected].join(';')}}`;
}
