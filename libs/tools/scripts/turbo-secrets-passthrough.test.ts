import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECRETS } from '@libs/secrets/public/secrets';

const REPO_ROOT = join(import.meta.dirname, '../../..');

function loadPassThroughEnv(): readonly string[] {
  const turbo = JSON.parse(
    readFileSync(join(REPO_ROOT, 'turbo.json'), 'utf8')
  ) as { globalPassThroughEnv: readonly string[] };
  return turbo.globalPassThroughEnv;
}

function passesThrough(name: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) =>
    pattern.endsWith('*')
      ? name.startsWith(pattern.slice(0, -1))
      : name === pattern
  );
}

/**
 * Turbo runs tasks in strict env mode: a variable `secrets-run` injects but
 * `globalPassThroughEnv` does not name never reaches the task. Every deploy
 * and health task reads its secrets from the environment, so every registry
 * secret must pass through.
 */
describe('turbo globalPassThroughEnv', () => {
  // regression: turbo-strips-tofu-secrets
  test('passes the OpenTofu state, PlanetScale, and AWS provider secrets through', () => {
    const patterns = loadPassThroughEnv();
    expect(
      [
        'TOFU_STATE_PASSPHRASE',
        'TOFU_STATE_ACCESS_KEY_ID',
        'TOFU_STATE_SECRET_ACCESS_KEY',
        'PLANETSCALE_SERVICE_TOKEN_ID',
        'PLANETSCALE_SERVICE_TOKEN',
        'AWS_ACCOUNT_ACCESS_KEY_ID',
        'AWS_ACCOUNT_SECRET_ACCESS_KEY',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_SESSION_TOKEN',
        'AWS_ROLE_ARN',
      ].filter((name) => !passesThrough(name, patterns))
    ).toEqual([]);
  });

  // regression: turbo-strips-depot-context
  test('passes native CI tokens, organization and attempt links to tasks', () => {
    const patterns = loadPassThroughEnv();
    expect(
      ['DEPOT_TOKEN', 'DEPOT_ORG_ID', 'DEPOT_JOB_URL'].filter(
        (name) => !passesThrough(name, patterns)
      )
    ).toEqual([]);
  });

  test('passes every registry secret through', () => {
    const patterns = loadPassThroughEnv();
    expect(
      SECRETS.map((s) => s.name).filter(
        (name) => !passesThrough(name, patterns)
      )
    ).toEqual([]);
  });
});
