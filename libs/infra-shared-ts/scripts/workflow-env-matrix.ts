#!/usr/bin/env bun
/**
 * The environments the Health workflow fans out over, read from the env files
 * (`tofu/envs/<env>.tfvars.json`) so a new environment needs no workflow edit.
 * Printed as `GITHUB_OUTPUT` lines by a job that loads no secrets (the runner
 * drops any job output containing a masked value):
 *
 *   bun run libs/infra-shared-ts/scripts/workflow-env-matrix.ts >> "$GITHUB_OUTPUT"
 *
 *   production=["prd"]      runs in the GitHub `production` environment
 *   all=["dev","prd"]       probed by the Health workflow
 *
 * Every list is a JSON array; an empty one is `[]` (the workflow skips the
 * matrix job instead of handing GitHub an empty matrix). The Release workflow
 * names its environments in its own jobs; a test keeps those in step with the
 * env files.
 */
import type { EnvFile } from '@libs/infra-shared-ts/env-file';
import { ENV_FILES } from '@libs/infra-shared-ts/envs';

export type WorkflowEnvMatrix = {
  readonly standard: readonly string[];
  readonly production: readonly string[];
};

function byName(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Splits environments by `protection`, each list sorted by name. */
export function workflowEnvMatrix(envs: readonly EnvFile[]): WorkflowEnvMatrix {
  const names = (protection: EnvFile['protection']): string[] =>
    envs
      .filter((env) => env.protection === protection)
      .map((env) => env.env)
      .sort(byName);
  return { standard: names('standard'), production: names('production') };
}

/** `GITHUB_OUTPUT` lines: `production` and `all` (standard first). */
export function workflowEnvOutputs(matrix: WorkflowEnvMatrix): string {
  const all = [...matrix.standard, ...matrix.production];
  return [
    `production=${JSON.stringify(matrix.production)}`,
    `all=${JSON.stringify(all)}`,
  ].join('\n');
}

if (import.meta.main) {
  console.log(workflowEnvOutputs(workflowEnvMatrix(Object.values(ENV_FILES))));
}
