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

// regression: sokoban-focus-ring-faint-on-light-page
test('the focused board ring reads against the page and the board edge in both themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    const color = tokens.color[theme];
    const hex = (name: string) => color[name]?.$value.hex ?? '';
    const ring = hex('gameSokobanFocus');
    expect(contrast(ring, hex('background'))).toBeGreaterThanOrEqual(3);
    expect(contrast(ring, hex('gameSokobanCanvas'))).toBeGreaterThanOrEqual(3);
  }
  // The dark theme keeps its gold ring.
  expect(tokens.color.dark['gameSokobanFocus']?.$value.hex).toBe('#f5cf6a');
  for (const sheet of [
    'pkgs/ui-root-client-ts/src/tile-board/tile-board.module.css',
    'pkgs/ui-root-client-ts/src/cell-grid-board/cell-grid-board.module.css',
  ])
    expect(read(sheet)).toContain(
      '--ui-color-focus-ring: var(--ui-color-game-sokoban-focus);'
    );
});
