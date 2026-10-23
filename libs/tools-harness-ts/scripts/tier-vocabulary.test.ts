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
      expect(biome).toContain(
        `./libs/tools-harness-ts/biome-plugins/${plugin}`
      );
    }
    for (const path of [
      'libs/permissions-shared-ts/src',
      'libs/permissions-client-ts/src',
      'libs/permissions-server-ts/src',
      'pkgs/permissions-shared-ts/src',
      'libs/billing-shared-ts/src',
      'libs/billing-client-ts/src',
      'libs/billing-server-ts/src',
    ]) {
      expect(biome).toContain(`"!**/${path}/**"`);
    }
  });

  test('sign-in state and access internals have their own rules', () => {
    const biome = readFileSync(join(REPO_ROOT, 'biome.json'), 'utf8');
    for (const plugin of [
      'import-access-facts.grit',
      'import-access-model.grit',
      'no-access-state-vocabulary.grit',
    ]) {
      expect(biome).toContain(
        `./libs/tools-harness-ts/biome-plugins/${plugin}`
      );
    }
  });
});
