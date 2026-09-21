import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');

/**
 * §22.11: tier vocabulary lives only in policy and billing. The Grit rules
 * enforce it inside each package's `lint`; this pins their registration.
 */
describe('§22.11 no tier coupling outside policy/ and billing/', () => {
  test('the Grit rules are registered with the same allowlist', () => {
    const biome = readFileSync(join(REPO_ROOT, 'biome.json'), 'utf8');
    for (const plugin of [
      'no-tier-vocabulary.grit',
      'no-tier-vocabulary-string.grit',
      'no-tier-words-puzzle.grit',
    ]) {
      expect(biome).toContain(`./libs/tools/biome-plugins/${plugin}`);
    }
    for (const path of [
      'libs/permissions',
      'pkgs/permissions',
      'libs/billing',
    ]) {
      expect(biome).toContain(`"!**/${path}/**"`);
    }
  });
});
