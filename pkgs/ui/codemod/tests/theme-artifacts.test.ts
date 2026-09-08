/**
 * Theme artifact coverage: the codemod is only correct if every class it
 * can emit resolves in `theme.css` and every converted element keeps a
 * base class from `base.css`.
 *
 * - Every token utility (`bg-<kebab>`, `text-<kebab>`, …) has an `@theme`
 *   entry whose value is the same `var(--ui-color-*)` the runtime emits.
 * - Every elevation utility maps to its `var(--ui-elevation-N)`.
 * - `base.css` preserves the exact host declarations for the selectors the
 *   codemod emits (`box`, `text`, `clickable`, …).
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { COLOR_PALETTE } from '../../src/theme/colors/color-palette';
import { tokenToKebab } from '../sx-map-color';
import { tokenKebabs } from './class-declaration';

const PKG_ROOT = resolve(process.cwd());

async function readArtifact(name: string): Promise<string> {
  return readFile(join(PKG_ROOT, 'codemod', name), 'utf8');
}

describe('theme.css coverage', () => {
  test('every palette token has a var-backed @theme entry', async () => {
    const css = await readArtifact('theme.css');
    for (const token of Object.keys(COLOR_PALETTE.light)) {
      const kebab = tokenToKebab(token);
      expect(css).toContain(`--color-${kebab}: var(--ui-color-${kebab});`);
    }
    expect(tokenKebabs().size).toBe(Object.keys(COLOR_PALETTE.light).length);
  });

  test('elevation utilities resolve to the elevation vars', async () => {
    const css = await readArtifact('theme.css');
    for (const level of [1, 2, 3, 4, 5]) {
      expect(css).toContain(
        `--color-elevation-${level}: var(--ui-elevation-${level});`
      );
    }
  });
});

describe('base.css coverage', () => {
  test('every emitted base class exists with its load-bearing declarations', async () => {
    const css = await readArtifact('base.css');
    const required: Readonly<Record<string, readonly string[]>> = {
      '.box': ['display: flex', 'flex-direction: column', 'min-width: 0'],
      '.text': ['display: inline', 'white-space: pre-wrap'],
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

  test('base.css matches hosts.module.css declaration for declaration', async () => {
    const base = await readArtifact('base.css');
    const hosts = await readFile(
      join(PKG_ROOT, 'src', 'components', 'hosts.module.css'),
      'utf8'
    );
    for (const selector of ['.box {', '.text {', '.clickable {', '.scroll {']) {
      const block = hosts.slice(
        hosts.indexOf(selector),
        hosts.indexOf('}', hosts.indexOf(selector))
      );
      const decls = block
        .slice(block.indexOf('{') + 1)
        .split(';')
        .map((d) => d.trim())
        .filter((d) => d.length > 0);
      for (const decl of decls) {
        expect(base).toContain(decl);
      }
    }
  });
});
