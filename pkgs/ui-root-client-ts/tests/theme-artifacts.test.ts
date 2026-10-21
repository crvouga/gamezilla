/**
 * The Tailwind theme is the design tokens and nothing else: every palette
 * role is a var-backed `@theme` color, the breakpoints written out for media
 * queries are the token breakpoints, every stock namespace is cleared, and
 * `hosts.css` stays layered so utilities can override host defaults.
 */

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { breakpoint } from '@pkgs/ui-root-shared-ts/breakpoints';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared-ts/color-palette';

const SRC = join(import.meta.dir, '..', 'src');

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

async function read(name: string): Promise<string> {
  return Bun.file(join(SRC, name)).text();
}

describe('theme.css', () => {
  test('every palette role has a var-backed @theme color', async () => {
    const css = await read('theme.css');
    for (const token of Object.keys(COLOR_PALETTE.light)) {
      const name = kebab(token);
      expect(css).toContain(`--color-${name}: var(--ui-color-${name});`);
    }
  });

  test('breakpoints are the token breakpoints', async () => {
    const css = await read('theme.css');
    for (const [name, px] of Object.entries(breakpoint)) {
      expect(css).toContain(`--breakpoint-${name}: ${px}px;`);
    }
    expect(css.match(/--breakpoint-[a-z0-9]+:/g)?.length).toBe(
      Object.keys(breakpoint).length
    );
  });

  test('every stock Tailwind namespace is cleared', async () => {
    const css = await read('theme.css');
    for (const namespace of [
      'color',
      'text',
      'font',
      'font-weight',
      'leading',
      'tracking',
      'radius',
      'shadow',
      'ease',
      'animate',
      'container',
      'breakpoint',
    ]) {
      expect(css).toContain(`--${namespace}-*: initial;`);
    }
  });

  test('there is one shadow, and it is the float token', async () => {
    const css = await read('theme.css');
    expect(css.match(/^\s*--shadow-[a-z]+:/gm)).toEqual(['  --shadow-float:']);
  });
});

describe('hosts.css', () => {
  test('is layered so Tailwind utilities can override host defaults', async () => {
    const css = await read('hosts.css');
    const layer = css.indexOf('@layer components');
    expect(layer).toBeGreaterThanOrEqual(0);
    expect(css.indexOf('.box {')).toBeGreaterThan(layer);
  });

  test('type roles read only the type tokens', async () => {
    const css = await read('hosts.css');
    const roles = css.slice(
      css.indexOf('.textBody {'),
      css.indexOf('.clickable {')
    );
    expect(roles).not.toMatch(/font-size:\s*\d/);
    expect(roles).not.toMatch(/font-weight:\s*\d/);
    expect(roles).not.toMatch(/line-height:\s*\d/);
  });
});
