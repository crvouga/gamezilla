import { expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyPlanContext } from './verify-shard-run';

test('a shard without a browser restores both planned platform fingerprints', () => {
  // regression: verify-nonbrowser-host-key-missing
  const root = mkdtempSync(join(tmpdir(), 'verify-plan-context-'));
  try {
    const directory = join(root, '.cache/verify-ci');
    mkdirSync(directory, { recursive: true });
    const platformKey = JSON.stringify({
      platform: process.platform,
      arch: process.arch,
      bun: Bun.version,
      chrome: '154.0.8037.92',
    });
    writeFileSync(
      join(directory, 'context.json'),
      JSON.stringify({
        secretsRange: 'base..head',
        platformKey,
      })
    );
    applyPlanContext({}, root);
    expect(
      JSON.parse(readFileSync(join(root, 'turbo-host-key.json'), 'utf8'))
    ).toEqual({
      platform: process.platform,
      arch: process.arch,
    });
    expect(readFileSync(join(root, 'turbo-platform-key.json'), 'utf8')).toBe(
      platformKey
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
