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

const sheet = read(
  'pkgs/ui-root-client-ts/src/trail-arena/trail-arena.module.css'
);

/** The token a rule's property names, `--ui-color-<name>` → `<name>`. */
function tokenOf(selector: string, property: string): string | undefined {
  const block = sheet.split(`${selector} {`)[1]?.split('}')[0] ?? '';
  return new RegExp(`${property}: var\\(--ui-color-([a-z-]+)\\);`).exec(
    block
  )?.[1];
}

/** The arena's local token, resolved to the Light Cycles colour it names. */
function arenaHex(theme: 'light' | 'dark', local: string): string {
  const name =
    new RegExp(
      `--ui-color-${local}: var\\(--ui-color-game-light-cycles-([a-z]+)\\);`
    ).exec(sheet)?.[1] ?? local.replace('game-light-cycles-', '');
  const key = `gameLightCycles${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  return tokens.color[theme][key]?.$value.hex ?? '';
}

// axe cannot judge SVG text, so a head's letter and the crash badge are
// checked here against the colours the arena actually draws them in.
test('rider letters read on every head and the crash cross reads on its badge, in both themes', () => {
  expect(tokenOf('.mark', 'fill')).toBe('background');
  expect(sheet.split('.disc {')[1]?.split('}')[0]).toContain(
    'fill: var(--rider-color);'
  );
  expect(tokenOf('.crashBadge', 'fill')).toBe('destructive-surface');
  expect(tokenOf('.crashCross', 'stroke')).toBe('background');
  const riders = [
    ...sheet.matchAll(
      /\.arena \[data-rider="\d"\] \{\s*--rider-color: var\(--ui-color-(game-light-cycles-[a-z]+)\);/g
    ),
  ].map((match) => match[1] ?? '');
  expect(riders).toHaveLength(4);
  for (const theme of ['light', 'dark'] as const) {
    const ground = arenaHex(theme, 'background');
    for (const rider of riders)
      expect(contrast(ground, arenaHex(theme, rider))).toBeGreaterThanOrEqual(
        4.5
      );
    const badge = tokens.color[theme]['destructiveSurface']?.$value.hex ?? '';
    expect(contrast(badge, ground)).toBeGreaterThanOrEqual(3);
  }
});

// regression: light-cycles-crash-badge-in-rider-colour
// regression: light-cycles-crashed-letter-faint
test("a crash is never drawn in a rider's colour, and a crashed rider's letter is not dimmed", () => {
  const riders = new Set(
    [...sheet.matchAll(/--rider-color: var\(--ui-color-([a-z-]+)\);/g)].map(
      (match) => match[1]
    )
  );
  for (const [selector, property] of [
    ['.crashBadge', 'fill'],
    ['.crashCross', 'stroke'],
  ] as const) {
    const token = tokenOf(selector, property) ?? '';
    const resolved =
      new RegExp(`--ui-color-${token}: var\\(--ui-color-([a-z-]+)\\);`).exec(
        sheet
      )?.[1] ?? token;
    expect(riders.has(resolved)).toBe(false);
  }
  expect(sheet).not.toMatch(/\.head\[data-alive="false"\] \{[^}]*opacity/);
  for (const theme of ['light', 'dark'] as const) {
    const ground = arenaHex(theme, 'background');
    for (const rider of riders)
      expect(
        contrast(arenaHex(theme, rider ?? ''), ground)
      ).toBeGreaterThanOrEqual(4.5);
  }
});
