import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EnvFile } from '@libs/infra-shared/env-file';
import { parseEnvFile } from '@libs/infra-shared/env-file';
import { ENV_FILES } from '@libs/infra-shared/envs';
import {
  workflowEnvMatrix,
  workflowEnvOutputs,
} from '../../infra-shared/scripts/workflow-env-matrix';

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
    expect(
      workflowEnvOutputs({ standard: [], production: ['prd'] }, 'shared')
    ).toBe('standard=[]\nproduction=["prd"]\nall=["prd"]\nshared=shared');
  });
});

type Job = { env?: Record<string, unknown> };

describe.each(['deploy.yml', 'health.yml'])('%s', (file) => {
  const workflow = Bun.YAML.parse(
    readFileSync(join(WORKFLOWS_DIR, file), 'utf8')
  ) as { jobs: Record<string, Job> };

  // Adding tofu/envs/<env>.tfvars.json must need no workflow edit.
  test('every secrets env comes from the env matrix, never a literal', () => {
    const secretsEnvs = Object.entries(workflow.jobs).flatMap(([id, job]) =>
      job.env?.['SECRETS_ENV'] === undefined
        ? []
        : [[id, job.env['SECRETS_ENV']] as const]
    );
    expect(secretsEnvs.length).toBeGreaterThan(0);
    const pinnedDev = secretsEnvs.filter(([, value]) => value === 'dev');
    expect(pinnedDev.map(([id]) => id)).toEqual(
      file === 'deploy.yml' ? ['deploy-plan'] : []
    );
    for (const [, value] of secretsEnvs.filter(
      ([, value]) => value !== 'dev'
    )) {
      expect([
        '${{ matrix.env }}',
        '${{ needs.deploy-matrix.outputs.shared }}',
      ]).toContain(value as string);
    }
  });
});
