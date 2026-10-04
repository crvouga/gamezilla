/**
 * Token color utilities (`bg-surface-overlay`, …) only exist when `@theme` is
 * compiled inside the Tailwind entry. A separate Vite CSS import of theme.css
 * leaves raw `@theme` in the browser and generates nothing — menus/modals then
 * render with transparent backgrounds.
 *
 * Invokes the workspace `@tailwindcss/cli` binary directly. `bunx @tailwindcss/cli`
 * can hang indefinitely on cold resolve under disk pressure; the local package
 * path finishes the monorepo compile in ~2s.
 */

import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = resolve(import.meta.dir, '..');
const REPO_ROOT = resolve(PKG_ROOT, '../..');
const ENTRY = fileURLToPath(
  import.meta.resolve('@pkgs/tailwind-shared/tailwind.css')
);
const CLI = join(
  dirname(fileURLToPath(import.meta.resolve('@tailwindcss/cli/package.json'))),
  'dist/index.mjs'
);

describe('token color utilities', () => {
  test('compiling the Tailwind entry emits bg-surface-overlay', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'tw-theme-'));
    const out = join(scratch, 'out.css');
    try {
      const proc = Bun.spawn(
        ['bun', CLI, '-i', ENTRY, '-o', out, '--cwd', REPO_ROOT],
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
    // Scans the whole monorepo: ~3 s alone, past bun's 5 s default under a
    // parallel turbo run.
  }, 30_000);
});
