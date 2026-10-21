import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  POPULATION_BUILD_COMMAND,
  POPULATION_BUN_VERSION,
  POPULATION_NODE_VERSION,
  POPULATION_START_COMMAND,
  populationDockerfile,
  populationReleaseArgs,
  railwayCliEnvironment,
} from '@libs/infra-server-ts/population-release';

const VERSION = 'a'.repeat(40);
const DEPLOYMENT = {
  projectId: '11111111-1111-1111-1111-111111111111',
  environmentId: '22222222-2222-2222-2222-222222222222',
  serviceId: '33333333-3333-3333-3333-333333333333',
};

// regression: railway-worker-builds-from-dockerfile
test('the worker release carries a Dockerfile that builds and starts with Bun', () => {
  const dockerfile = populationDockerfile();
  expect(dockerfile).toContain(`RUN ${POPULATION_BUILD_COMMAND}`);
  expect(dockerfile).toContain(POPULATION_START_COMMAND);
  expect(dockerfile).toContain(`FROM oven/bun:${POPULATION_BUN_VERSION}`);
  expect(dockerfile).toContain(`node:${POPULATION_NODE_VERSION}`);
});

test('the image uses the Bun and Node versions the repository pins', () => {
  const mise = readFileSync(
    join(import.meta.dirname, '../../../mise.toml'),
    'utf8'
  );
  expect(mise).toContain(`bun = "${POPULATION_BUN_VERSION}"`);
  expect(mise).toContain(`node = "${POPULATION_NODE_VERSION}"`);
});

test('the release sets the commit version before uploading the archive', () => {
  const args = populationReleaseArgs(
    ['railway'],
    VERSION,
    DEPLOYMENT,
    '/tmp/stage'
  );
  expect(args.versionArgs).toEqual([
    'railway',
    'variable',
    'set',
    `DEPLOYMENT_VERSION=${VERSION}`,
    '--project',
    DEPLOYMENT.projectId,
    '--environment',
    DEPLOYMENT.environmentId,
    '--service',
    DEPLOYMENT.serviceId,
    '--skip-deploys',
  ]);
  expect(args.versionArgs).not.toContain('--ci');
  expect(args.upArgs).toContain('--ci');
  expect(args.upArgs).toContain('/tmp/stage');
  expect(args.upArgs).toContain(`Synthetic Population Worker ${VERSION}`);
  expect(args.upArgs.join(' ')).not.toContain('docker');
});

// regression: railway-workspace-token-read-as-project-token
test('the Railway CLI gets the workspace token under the name it reads', () => {
  const env = railwayCliEnvironment({
    RAILWAY_TOKEN: 'workspace',
    RAILWAY_API_TOKEN: 'older',
    PATH: '/bin',
    UNSET: undefined,
  });
  expect(env['RAILWAY_API_TOKEN']).toBe('workspace');
  expect(env['RAILWAY_TOKEN']).toBeUndefined();
  expect(env['PATH']).toBe('/bin');
  expect('UNSET' in env).toBe(false);
});
