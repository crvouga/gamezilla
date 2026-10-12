import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV_FILES } from '@libs/infra-shared/envs';
import { GLOBAL } from '@libs/infra-shared/global';
import { COMMITTED_EMQX_CREDENTIALS } from '@pkgs/emqx-shared/ports';
import secretNames from '../../infra-shared/tofu/stacks/foundation/secrets.json';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const WRITTEN = new Set([...secretNames.generated, ...secretNames.derived]);

describe('tofu/global.tfvars.json', () => {
  test('main requires exactly the gate job of every workflow that reports on PRs', () => {
    const gates: string[] = [];
    for (const file of new Bun.Glob('*.yml').scanSync(
      join(REPO_ROOT, '.github/workflows')
    )) {
      const workflow = Bun.YAML.parse(
        readFileSync(join(REPO_ROOT, '.github/workflows', file), 'utf8')
      ) as {
        name?: string;
        on?: Record<string, unknown>;
        jobs?: Record<string, { name?: string }>;
      };
      const onPullRequest =
        workflow.on !== undefined && 'pull_request' in workflow.on;
      // The gate is the workflow's ending word, the job whose id ends
      // `-end`. Only Check PR reports on pull requests, and its `check:end`
      // keeps that name wherever the gate runs.
      const gate = Object.entries(workflow.jobs ?? {}).find(([id]) =>
        id.endsWith('-end')
      )?.[1];
      if (onPullRequest && gate?.name !== undefined) gates.push(gate.name);
    }
    expect([...GLOBAL.github.required_checks].sort()).toEqual(gates.sort());
  });

  // regression: transferred-repo-protection-import
  test('creates main protection instead of adopting the retired gamezilla:main rule', () => {
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
