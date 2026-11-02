import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EnvFile } from '@libs/infra-shared-ts/env-file';
import { parseEnvFile } from '@libs/infra-shared-ts/env-file';
import { ENV_FILES } from '@libs/infra-shared-ts/envs';
import {
  workflowEnvMatrix,
  workflowEnvOutputs,
} from '../../infra-shared-ts/scripts/workflow-env-matrix';

const WORKFLOWS_DIR = join(import.meta.dirname, '../../../.github/workflows');

function withName(
  base: EnvFile,
  env: string,
  protection: EnvFile['protection']
): EnvFile {
  return parseEnvFile({ ...base, env, protection }, `synthetic ${env}`);
}

describe('workflow env matrix', () => {
  test('the current env files: dev deploys first, prd after', () => {
    expect(workflowEnvMatrix(Object.values(ENV_FILES))).toEqual({
      standard: ['dev'],
      production: ['prd'],
    });
  });

  test('a new standard env lands in the standard list, sorted', () => {
    const dev = ENV_FILES['dev'];
    expect(dev).toBeDefined();
    if (dev === undefined) return;
    const envs = [
      ...Object.values(ENV_FILES),
      withName(dev, 'staging', 'standard'),
    ];
    expect(workflowEnvMatrix(envs)).toEqual({
      standard: ['dev', 'staging'],
      production: ['prd'],
    });
  });

  test('outputs are JSON arrays; an empty list is `[]`', () => {
    expect(workflowEnvOutputs({ standard: [], production: ['prd'] })).toBe(
      'production=["prd"]\nall=["prd"]'
    );
  });
});

type Job = { env?: Record<string, unknown>; environment?: string; if?: string };

// Adding tofu/envs/<env>.tfvars.json must need no Health workflow edit.
test('Health uses the env matrix for environments and shared secrets only for protected repository policy', () => {
  const workflow = Bun.YAML.parse(
    readFileSync(join(WORKFLOWS_DIR, 'health.yml'), 'utf8')
  ) as { jobs: Record<string, Job> };
  const admin = workflow.jobs['health-repository-policy'];
  expect(admin?.env?.['SECRETS_ENV']).toBe('shared');
  expect(admin?.environment).toBe('production');
  expect(admin?.if).toBe("github.ref == 'refs/heads/main'");
  const secretsEnvs = Object.entries(workflow.jobs).flatMap(([name, job]) =>
    name === 'health-repository-policy'
      ? []
      : job.env?.['SECRETS_ENV'] === undefined
        ? []
        : [job.env['SECRETS_ENV']]
  );
  expect(secretsEnvs.length).toBeGreaterThan(0);
  for (const value of secretsEnvs) expect(value).toBe('${{ matrix.env }}');
});

// Release names its environments in its own jobs, so an env file without one
// would silently never ship.
test('Release has one job per env file, standard before production', () => {
  const workflow = Bun.YAML.parse(
    readFileSync(join(WORKFLOWS_DIR, 'deploy.yml'), 'utf8')
  ) as { jobs: Record<string, Job & { needs?: string }> };
  const { standard, production } = workflowEnvMatrix(Object.values(ENV_FILES));
  for (const env of [...standard, ...production]) {
    expect(workflow.jobs[`deploy-${env}`]?.env?.['SECRETS_ENV']).toBe(env);
  }
  for (const env of production) {
    expect(workflow.jobs[`deploy-${env}`]?.needs).toBe(
      `deploy-${standard[standard.length - 1]}`
    );
  }
});
