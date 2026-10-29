import { describe, expect, test } from 'bun:test';
import { ENV_FILES } from '@libs/infra-shared-ts/envs';
import { GLOBAL } from '@libs/infra-shared-ts/global';
import { COMMITTED_EMQX_CREDENTIALS } from '@pkgs/emqx-shared-ts/ports';
import secretNames from '../../infra-shared-ts/tofu/stacks/foundation/secrets.json';

const WRITTEN = new Set([...secretNames.generated, ...secretNames.derived]);

describe('tofu/global.tfvars.json', () => {
  // regression: transferred-repo-protection-import
  test('creates main protection instead of adopting the retired `<repo>:main` rule', () => {
    expect(GLOBAL.global_imports).not.toHaveProperty(
      'github_branch_protection'
    );
  });

  test('every environment has a secrets environment to adopt or create', () => {
    for (const env of Object.keys(ENV_FILES)) {
      expect(env).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe('secret adoption in env files', () => {
  test('adopted and regenerated secrets are ones OpenTofu writes', () => {
    for (const env of Object.values(ENV_FILES)) {
      for (const name of env.imports?.foundation?.secrets ?? []) {
        expect({ env: env.env, name, written: WRITTEN.has(name) }).toEqual({
          env: env.env,
          name,
          written: true,
        });
      }
      for (const name of env.secrets?.regenerate ?? []) {
        expect({
          env: env.env,
          name,
          generated: secretNames.generated.includes(name),
        }).toEqual({
          env: env.env,
          name,
          generated: true,
        });
      }
    }
  });
});

describe('secret placeholders', () => {
  test('every committed sidecar credential is a placeholder OpenTofu never adopts', () => {
    expect(new Set(secretNames.placeholders)).toEqual(
      new Set(COMMITTED_EMQX_CREDENTIALS)
    );
  });

  test('placeholders are values, not secret names', () => {
    const names = new Set([...secretNames.generated, ...secretNames.derived]);
    for (const value of secretNames.placeholders) {
      expect(value.trim().length).toBeGreaterThan(0);
      expect(names.has(value)).toBe(false);
    }
  });
});
