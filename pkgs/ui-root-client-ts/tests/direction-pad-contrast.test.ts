import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(import.meta.dir, '../../..');
const read = (path: string) => readFileSync(join(repo, path), 'utf8');

type Color = { readonly $value: { readonly hex: string } };
const tokens = JSON.parse(
  read('pkgs/ui-root-shared-ts/src/design-tokens.json')
) as { color: Record<'light' | 'dark', Record<string, Color>> };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

// regression: direction-pad-edges-vanish-on-page
test('each direction button edge reads against the page in both themes', () => {
  const sheet = read(
    'pkgs/ui-root-client-ts/src/direction-pad/direction-pad.module.css'
  );
  const border =
    /\.button \{[^}]*border: var\(--ui-space-hairline\) solid var\(--ui-color-([a-z-]+)\);/.exec(
      sheet
    )?.[1];
  expect(border).toBe('outline');
  for (const theme of ['light', 'dark'] as const) {
    const color = tokens.color[theme];
    const hex = (name: string) => color[name]?.$value.hex ?? '';
    for (const page of ['background', 'surface'])
      expect(contrast(hex('outline'), hex(page))).toBeGreaterThanOrEqual(3);
  }
});
