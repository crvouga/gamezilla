import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { WRANGLER_CWD } from './report-publish';

describe('report-publish', () => {
  // regression: report-publish-wrangler-not-found
  test('finds wrangler with only Bun on PATH, as on a CI runner', () => {
    // A laptop's global wrangler would hide the bug, so PATH holds Bun alone.
    const home = mkdtempSync(join(tmpdir(), 'report-publish-'));
    try {
      const bin = join(home, 'bin');
      mkdirSync(bin);
      symlinkSync(process.execPath, join(bin, 'bun'));
      const result = Bun.spawnSync(
        [process.execPath, 'x', '--no-install', 'wrangler', '--version'],
        {
          cwd: WRANGLER_CWD,
          env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home },
        }
      );
      expect(result.stderr.toString()).not.toContain('Could not find');
      expect(result.exitCode).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
