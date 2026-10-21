import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { REPO_ROOT, SECRETS_PKG_ROOT } from '@libs/secrets-server-ts/paths';

describe('secrets paths', () => {
  test('the package root is libs/secrets-server-ts', () => {
    expect(SECRETS_PKG_ROOT).toBe(
      join(REPO_ROOT, 'libs', basename(SECRETS_PKG_ROOT))
    );
    expect(existsSync(join(SECRETS_PKG_ROOT, 'package.json'))).toBe(true);
  });

  test('the repo root holds the secrets config every script reads', () => {
    expect(existsSync(join(REPO_ROOT, '.secrets.json'))).toBe(true);
  });
});
