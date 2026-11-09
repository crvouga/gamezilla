import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type GameSeatColor,
  GameSeatSwatch,
} from '@pkgs/ui-root-client-ts/game-seat-swatch';
import { cleanup, render } from '@solidjs/testing-library';

afterEach(cleanup);

const repo = join(import.meta.dir, '../../..');
type Color = { readonly $value: { readonly hex: string } };
const tokens = JSON.parse(
  readFileSync(
    join(repo, 'pkgs/ui-root-shared-ts/src/design-tokens.json'),
    'utf8'
  )
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

/** The token a utility class paints with: `bg-game-light-cycles-ink` → `gameLightCyclesInk`. */
function tokenOf(utility: string, prefix: string): string {
  return utility
    .slice(prefix.length)
    .replace(/-([a-z0-9])/g, (_, next: string) => next.toUpperCase());
}

const COLORS: readonly GameSeatColor[] = [
  'disc-one',
  'disc-two',
  'trail-one',
  'trail-two',
  'trail-three',
  'trail-four',
  'player1',
  'player2',
  'player3',
  'player4',
  'player5',
  'player6',
  'player7',
  'player8',
];

const CARDS = ['surface', 'surfaceMuted', 'background'] as const;

// regression: seat-swatch-light-paint-vanishes-on-card — in the light theme
// a light paint (Light Cycles' ink rider, its accent, a pale disc) sat on a
// white card at about 1.1:1 to 2.2:1, so the swatch all but vanished.
test('every painted seat swatch stands out from every card at 3:1 or more, in both themes', () => {
  for (const color of COLORS) {
    const view = render(() => <GameSeatSwatch look={{ color, mark: 'V' }} />);
    const swatch = view.container.querySelector(
      '[data-component="GameSeatSwatch"]'
    );
    const classes = [...(swatch?.classList ?? [])];
    const paint = classes.find((name) => name.startsWith('bg-')) ?? '';
    const ring = classes.find(
      (name) => name.startsWith('border-') && name !== 'border'
    );
    expect(ring).toBe('border-outline');
    for (const theme of ['light', 'dark'] as const) {
      const hex = (name: string) => tokens.color[theme][name]?.$value.hex ?? '';
      for (const card of CARDS) {
        const best = Math.max(
          contrast(hex(tokenOf(paint, 'bg-')), hex(card)),
          contrast(hex(tokenOf(ring ?? '', 'border-')), hex(card))
        );
        expect(best).toBeGreaterThanOrEqual(3);
      }
    }
    view.unmount();
  }
});
