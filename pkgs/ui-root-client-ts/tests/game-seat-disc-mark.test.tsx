import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { cleanup, render } from '@solidjs/testing-library';
import { GameSeatSwatch } from '../src/game-seat-swatch/index';

afterEach(cleanup);

type Hex = { $value: { hex: string } };
const tokens = JSON.parse(
  readFileSync(
    new URL('../../ui-root-shared-ts/src/design-tokens.json', import.meta.url),
    'utf8'
  )
) as { color: Record<'light' | 'dark', Record<string, Hex>> };

/** `text-game-connect-four-ink` / `bg-game-connect-four-one` → token name. */
function tokenOf(utility: string, prefix: 'text-' | 'bg-'): string {
  const words = utility.slice(prefix.length).split('-');
  return words
    .map((word, index) =>
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join('');
}

function luminance(hex: string): number {
  return [1, 3, 5]
    .map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * ([0.2126, 0.7152, 0.0722][i] ?? 0), 0);
}

function ratio(a: string, b: string): number {
  const [high = 0, low = 0] = [luminance(a), luminance(b)].sort(
    (x, y) => y - x
  );
  return (high + 0.05) / (low + 0.05);
}

// regression: connect-four-seat-chip-mark-low-contrast
test('disc seat chips draw their mark at 3:1 or more on the chip in both themes', () => {
  for (const [color, mark] of [
    ['disc-one', '●'],
    ['disc-two', '◆'],
  ] as const) {
    const view = render(() => <GameSeatSwatch look={{ color, mark }} />);
    const chip = view.container.querySelector('[data-seat-color]');
    const glyph = chip?.querySelector('span');
    const paint = [...(chip?.classList ?? [])].find((c) =>
      c.startsWith('bg-game-')
    );
    const inks = [...(glyph?.classList ?? [])].filter((c) =>
      c.startsWith('text-game-')
    );
    expect(paint).toBeDefined();
    expect(inks).toHaveLength(1);
    for (const theme of ['light', 'dark'] as const) {
      const palette = tokens.color[theme];
      const chipHex = palette[tokenOf(paint ?? '', 'bg-')]?.$value.hex ?? '';
      const inkHex = palette[tokenOf(inks[0] ?? '', 'text-')]?.$value.hex ?? '';
      expect(ratio(inkHex, chipHex)).toBeGreaterThanOrEqual(3);
    }
    cleanup();
  }
});
