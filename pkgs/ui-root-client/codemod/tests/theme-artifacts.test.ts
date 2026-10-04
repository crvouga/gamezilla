/**
 * Theme artifact coverage: the codemod is only correct if every class it
 * can emit resolves in `theme.css` and every converted element keeps a
 * base class from `hosts.css` (exported as `@pkgs/ui/base.css`).
 *
 * - Every token utility (`bg-<kebab>`, `text-<kebab>`, …) has an `@theme`
 *   entry whose value is the same `var(--ui-color-*)` the runtime emits.
 * - Every elevation utility maps to its `var(--ui-elevation-N)`.
 * - `hosts.css` preserves the exact host declarations for the selectors the
 *   codemod emits (`box`, `text`, `clickable`, …).
 */

import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared/color-palette';
import { tokenToKebab } from '../sx-map-color';
import { tokenKebabs } from './class-declaration';

const PKG_ROOT = resolve(process.cwd());

async function readCodemodArtifact(name: string): Promise<string> {
  return readFile(join(PKG_ROOT, 'codemod', name), 'utf8');
}

async function readHostsCss(): Promise<string> {
  return readFile(join(PKG_ROOT, 'src/hosts.css'), 'utf8');
}

describe('theme.css coverage', () => {
  test('every palette token has a var-backed @theme entry', async () => {
    const css = await readCodemodArtifact('theme.css');
    for (const token of Object.keys(COLOR_PALETTE.light)) {
      const kebab = tokenToKebab(token);
      expect(css).toContain(`--color-${kebab}: var(--ui-color-${kebab});`);
    }
    expect(tokenKebabs().size).toBe(Object.keys(COLOR_PALETTE.light).length);
  });

  test('elevation utilities resolve to the elevation vars', async () => {
    const css = await readCodemodArtifact('theme.css');
    for (const level of [1, 2, 3, 4, 5]) {
      expect(css).toContain(
        `--color-elevation-${level}: var(--ui-elevation-${level});`
      );
    }
  });
});

describe('hosts.css coverage', () => {
  test('every emitted base class exists with its load-bearing declarations', async () => {
    const css = await readHostsCss();
    const required: Readonly<Record<string, readonly string[]>> = {
      '.box': ['display: flex', 'flex-direction: column', 'min-width: 0'],
      '.text': ['white-space: pre-wrap', 'font-size: var(--ui-font-size-base)'],
      '.textHeading': ['font-weight: 800'],
      '.textMono': ['var(--ui-font-mono)'],
      '.clickable': ['cursor: pointer', 'appearance: none'],
      '.clickableTint::after': ['pointer-events: none'],
      '.scroll': ['overflow-y: auto'],
      '.scrollContent': ['display: flex'],
    };
    for (const selector of Object.keys(required)) {
      expect(css).toContain(selector);
      for (const decl of required[selector] ?? []) {
        expect(css).toContain(decl);
      }
    }
  });

  test('hosts.css is layered so Tailwind utilities can override defaults', async () => {
    const css = await readHostsCss();
    expect(css).toContain('@layer components');
    // Unlayered `.box { padding: 0 }` would beat `@layer utilities` `.p-4`.
    const layerIdx = css.indexOf('@layer components');
    const boxIdx = css.indexOf('.box {');
    expect(layerIdx).toBeGreaterThanOrEqual(0);
    expect(boxIdx).toBeGreaterThan(layerIdx);
  });
});
