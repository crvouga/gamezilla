/**
 * Staleness guard for the committed SPA bundle, mirroring `@pkgs/ui`
 * `tokens:check`: the generated module must be exactly what the generator
 * produces, or a fresh clone would serve a bundle nobody built.
 */

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const SCRIPT = join(import.meta.dir, '..', 'scripts', 'build-web-assets.ts');

describe('embedded SPA assets', () => {
  test('assets.generated.ts is up to date', async () => {
    const proc = Bun.spawnSync(['bun', 'run', SCRIPT, '--check'], {
      cwd: join(import.meta.dir, '..'),
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(proc.stderr.toString()).not.toContain('stale');
    expect(proc.exitCode).toBe(0);
  }, 120_000);
});
