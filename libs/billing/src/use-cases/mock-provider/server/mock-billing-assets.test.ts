/**
 * Staleness guard for the embedded mock billing SPA: the generated module must
 * be exactly what the generator produces, or the API would serve a bundle
 * nobody built (mirrors `@pkgs/idp-google-sim` `assets.test.ts`).
 */

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const PACKAGE_DIR = join(import.meta.dir, '../../../..');
const SCRIPT = join(PACKAGE_DIR, 'scripts', 'build-mock-billing.ts');

describe('embedded mock billing SPA', () => {
  test('mock-billing-assets.generated.ts is up to date', () => {
    const proc = Bun.spawnSync(['bun', 'run', SCRIPT, '--check'], {
      cwd: PACKAGE_DIR,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(proc.stderr.toString()).not.toContain('stale');
    expect(proc.exitCode).toBe(0);
  }, 120_000);
});
