import { expect, test } from 'bun:test';
import { renderTokensCss } from '@pkgs/ui-root-shared-ts/css-vars';
import { withDocumentPalette } from '@pkgs/ui-root-shared-ts/document-palette';

// regression: startup-metrics-shift
test('opening typography, radius and materials resolve before the application stylesheet arrives', () => {
  const css =
    'button{background:var(--ui-finish-action);box-shadow:var(--ui-depth-control)}aside{background:var(--ui-finish-slot);box-shadow:var(--ui-depth-slot)}h1{font-weight:var(--ui-text-display-weight);font-size:var(--ui-text-display-size,26px)}main{font-family:var(--ui-font-sans);line-height:var(--ui-text-body-leading,22px);border-radius:var(--ui-radius-control,12px)}';
  const opening = withDocumentPalette(css);
  const full = renderTokensCss();
  const definitions = (source: string) =>
    new Map(
      [...source.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)].map((match) => [
        match[1],
        match[2]?.trim(),
      ])
    );
  const resolve = (
    values: Map<string | undefined, string | undefined>,
    name: string
  ): string | undefined => {
    const value = values.get(name);
    const alias = value?.match(/^var\((--[\w-]+)\)$/)?.[1];
    return alias ? resolve(values, alias) : value;
  };
  const initial = definitions(opening);
  const final = definitions(full);
  for (const name of [
    '--ui-text-display-size',
    '--ui-font-sans',
    '--ui-text-display-weight',
    '--ui-text-body-leading',
    '--ui-radius-control',
    '--ui-finish-action',
    '--ui-depth-control',
    '--ui-finish-slot',
    '--ui-depth-slot',
  ]) {
    expect(initial.has(name)).toBe(true);
    expect(initial.get(name)).toBe(resolve(final, name));
  }
  for (const value of initial.values()) {
    for (const alias of value?.matchAll(/var\((--[\w-]+)/g) ?? []) {
      expect(initial.has(alias[1])).toBe(true);
      expect(initial.get(alias[1])).toBe(final.get(alias[1]));
    }
  }
});
