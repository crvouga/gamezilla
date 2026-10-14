#!/usr/bin/env bun
// @io-wall-ok — publishes verified code to an already OpenTofu-managed service.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  populationDockerfile,
  populationReleaseArgs,
  railwayCliEnvironment,
} from '@libs/infra-server/population-release';
import { tofuLayout } from '@libs/infra-server/tofu-layout';
import { envFile } from '@libs/infra-shared/envs';
import { redactInfraOutput } from '@libs/infra-shared/redact-output';
import { outputArgs, tofuEnvironment } from '@libs/infra-shared/tofu-command';
import { resolveAwsSession } from './aws-session';
import { infraOperation } from './infra-operation';
import { pinnedTool, spawnTool } from './tofu-process';

function artifactCommand(
  cmd: readonly string[],
  cwd: string,
  env: Record<string, string | undefined> = process.env
): string {
  const result = Bun.spawnSync([...cmd], {
    cwd,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 900_000,
    killSignal: 'SIGKILL',
  });
  const stderr = redactInfraOutput(result.stderr.toString(), process.env);
  if (stderr) process.stderr.write(stderr);
  if (result.exitCode !== 0) {
    const stdout = redactInfraOutput(result.stdout.toString(), process.env);
    if (stdout) process.stderr.write(stdout.slice(-6000));
    throw new Error(
      `Synthetic Population Worker release ${cmd[0]} ${cmd.slice(1, 3).join(' ')} failed (exit ${result.exitCode})`
    );
  }
  return result.stdout.toString();
}

if (process.env['GITHUB_ACTIONS'] !== 'true')
  throw new Error('Worker publication runs only in GitHub Actions');
const environment = process.env['SECRETS_ENV'] ?? '';
envFile(environment);
const version = process.env['GITHUB_SHA'] ?? '';
if (!/^[0-9a-f]{40}$/.test(version))
  throw new Error('An exact verified commit is required');
const root = resolve(import.meta.dirname, '../../..');
const { paths } = tofuLayout(join(import.meta.dirname, '..'));
const target = { stack: 'foundation' as const, env: environment };
const credentials = await infraOperation(
  'foundation output credentials',
  (signal) => resolveAwsSession(process.env, 'foundation', signal)
);
const { env, missing } = tofuEnvironment(
  process.env,
  paths,
  target,
  credentials
);
if (missing.length)
  throw new Error(`Missing publication credentials: ${missing.join(', ')}`);
const output = spawnTool('tofu', outputArgs(paths, target), {
  env: { ...env },
  capture: true,
});
if (output.status !== 0)
  throw new Error(
    `Foundation outputs are unavailable (tofu output exited ${output.status}): ${output.stderr.trim().slice(0, 2000)}`
  );
const outputs = JSON.parse(output.stdout) as {
  population_deployment?: {
    value?: { project_id: string; service_id: string; environment_id: string };
  };
};
const deployment = outputs.population_deployment?.value;
if (
  !deployment ||
  !Object.values(deployment).every((id) => /^[0-9a-f-]{36}$/.test(id))
)
  throw new Error('Railway deployment outputs are invalid');
const stage = mkdtempSync(join(tmpdir(), 'synthetic-population-release-'));
try {
  const archive = `${stage}.tar`;
  artifactCommand(
    ['git', 'archive', '--format=tar', `--output=${archive}`, version],
    root
  );
  artifactCommand(['tar', '-xf', archive, '-C', stage], root);
  writeFileSync(join(stage, 'Dockerfile'), populationDockerfile());
  const release = populationReleaseArgs(
    pinnedTool('railway'),
    version,
    {
      projectId: deployment.project_id,
      environmentId: deployment.environment_id,
      serviceId: deployment.service_id,
    },
    stage
  );
  const railwayEnv = railwayCliEnvironment(process.env);
  artifactCommand(release.versionArgs, root, railwayEnv);
  const result = artifactCommand(release.upArgs, root, railwayEnv);
  process.stdout.write(redactInfraOutput(result, process.env));
} finally {
  rmSync(stage, { recursive: true, force: true });
  rmSync(`${stage}.tar`, { force: true });
}
