import { expect, test } from 'bun:test';
import {
  POPULATION_BUILD_COMMAND,
  POPULATION_START_COMMAND,
  populationRailwayConfig,
  populationReleaseArgs,
} from '@libs/infra-server/population-release';

const VERSION = 'a'.repeat(40);
const DEPLOYMENT = {
  projectId: '11111111-1111-1111-1111-111111111111',
  environmentId: '22222222-2222-2222-2222-222222222222',
  serviceId: '33333333-3333-3333-3333-333333333333',
};

test('the worker release tells Railway to build and start with Bun', () => {
  const config = JSON.parse(populationRailwayConfig()) as {
    build: { builder: string; buildCommand: string };
    deploy: { startCommand: string };
  };
  expect(config.build.builder).toBe('RAILPACK');
  expect(config.build.buildCommand).toBe(POPULATION_BUILD_COMMAND);
  expect(config.deploy.startCommand).toBe(POPULATION_START_COMMAND);
  expect(populationRailwayConfig()).not.toContain('DOCKERFILE');
  expect(populationRailwayConfig()).not.toContain('docker');
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
