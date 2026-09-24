/**
 * Staleness guard for the embedded hosted pages: the generated module must be
 * exactly what the generator produces, or the provider would serve a bundle
 * nobody built (mirrors `@pkgs/idp-sim` `assets.test.ts`).
 */

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const PACKAGE_DIR = join(import.meta.dir, '..');
const SCRIPT = join(PACKAGE_DIR, 'scripts', 'build-web-assets.ts');

describe('embedded hosted pages', () => {
  test('assets.generated.ts is up to date', () => {
    const proc = Bun.spawnSync(['bun', 'run', SCRIPT, '--check'], {
      cwd: PACKAGE_DIR,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(proc.stderr.toString()).not.toContain('stale');
    expect(proc.exitCode).toBe(0);
  }, 120_000);
});
