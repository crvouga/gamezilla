/**
 * Token color utilities (`bg-surface-overlay`, …) only exist when `@theme` is
 * compiled inside the Tailwind entry. A separate Vite CSS import of theme.css
 * leaves raw `@theme` in the browser and generates nothing — menus/modals then
 * render with transparent backgrounds.
 */

import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PKG_ROOT = resolve(import.meta.dir, '..');
const REPO_ROOT = resolve(PKG_ROOT, '../..');
const ENTRY = resolve(PKG_ROOT, 'src/tailwind.css');

describe('token color utilities', () => {
  test('compiling the Tailwind entry emits bg-surface-overlay', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'tw-theme-'));
    const out = join(scratch, 'out.css');
    try {
      const proc = Bun.spawn(
        [
          'bunx',
          '--bun',
          '@tailwindcss/cli',
          '-i',
          ENTRY,
          '-o',
          out,
          '--cwd',
          REPO_ROOT,
        ],
        { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' }
      );
      const code = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(code).toBe(0);
      expect(stderr).not.toMatch(/Error:/i);
      const css = await readFile(out, 'utf8');
      expect(css).toContain('.bg-surface-overlay');
      expect(css).toContain('--color-surface-overlay');
      expect(css).toContain('.border-border');
      expect(css).toContain('.bg-scrim');
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  });
});
