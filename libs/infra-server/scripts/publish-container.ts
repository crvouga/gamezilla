// @io-wall-ok — publishes verified code to an already OpenTofu-managed service.
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { tofuLayout } from '@libs/infra-server/tofu-layout';
import { envFile } from '@libs/infra-shared/envs';
import { redactInfraOutput } from '@libs/infra-shared/redact-output';
import { outputArgs, tofuEnvironment } from '@libs/infra-shared/tofu-command';
import { resolveAwsSession } from './aws-session';
import { infraOperation } from './infra-operation';
import { pinnedTool, spawnTool } from './tofu-process';

function artifactCommand(cmd: readonly string[], cwd: string): string {
  const result = Bun.spawnSync([...cmd], {
    cwd,
    env: process.env,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 900_000,
    killSignal: 'SIGKILL',
  });
  const stderr = redactInfraOutput(result.stderr.toString(), process.env);
  if (stderr) process.stderr.write(stderr);
  if (result.exitCode !== 0)
    throw new Error(`Population Worker artifact ${cmd[0]} failed`);
  return result.stdout.toString();
}

if (process.env['GITHUB_ACTIONS'] !== 'true')
  throw new Error('Container publication runs only in GitHub Actions');
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
if (output.status !== 0) throw new Error('Foundation outputs are unavailable');
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
const stage = mkdtempSync(join(tmpdir(), 'population-release-'));
try {
  const archive = `${stage}.tar`;
  artifactCommand(
    ['git', 'archive', '--format=tar', `--output=${archive}`, version],
    root
  );
  artifactCommand(['tar', '-xf', archive, '-C', stage], root);
  const atlas = artifactCommand(
    ['git', 'ls-tree', version, 'vendor/atlas'],
    root
  ).match(/^160000 commit ([0-9a-f]{40})/m)?.[1];
  if (!atlas) throw new Error('The verified Atlas dependency is unavailable');
  artifactCommand(
    ['git', 'archive', '--format=tar', `--output=${archive}`, atlas],
    join(root, 'vendor/atlas')
  );
  mkdirSync(join(stage, 'vendor/atlas'), { recursive: true });
  artifactCommand(
    ['tar', '-xf', archive, '-C', join(stage, 'vendor/atlas')],
    root
  );
  const dockerfile = readFileSync(
    join(stage, 'apps/population-worker/Dockerfile'),
    'utf8'
  );
  writeFileSync(
    join(stage, 'Dockerfile'),
    dockerfile.replace(
      'USER bun',
      `ENV DEPLOYMENT_VERSION=${version}\nUSER bun`
    )
  );
  const result = artifactCommand(
    [
      ...pinnedTool('railway'),
      'up',
      stage,
      '--path-as-root',
      '--project',
      deployment.project_id,
      '--environment',
      deployment.environment_id,
      '--service',
      deployment.service_id,
      '--ci',
      '--json',
      '--message',
      `Population Worker ${version}`,
    ],
    root
  );
  process.stdout.write(redactInfraOutput(result, process.env));
} finally {
  rmSync(stage, { recursive: true, force: true });
  rmSync(`${stage}.tar`, { force: true });
}
