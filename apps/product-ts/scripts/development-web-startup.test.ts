import { expect, test } from 'bun:test';
import { createWebStarter } from '@apps/product-ts/scripts/dev-services';
import {
  type DevelopmentServices,
  developmentManifest,
  readDevelopmentServices,
} from '@apps/product-ts/scripts/development-readiness';
import { DEVELOPMENT_PLAN } from './development-readiness-fixture';

// regression: unavailable-api-prevents-local-client-start
test('the local client starts despite the retained database and API failing', async () => {
  const spawnObserved = new Error('web startup reached');
  let apiOrigin: string | null = null;
  const start = createWebStarter(async (args) => {
    apiOrigin = args.apiOrigin;
    throw spawnObserved;
  });
  const outcome = await start({
    plan: DEVELOPMENT_PLAN,
    repoRoot: '/workspace',
    need: async () => {
      throw new Error('Invalid mix of BigInt and other type in addition.');
    },
  }).catch((error: unknown) => error);
  expect(outcome).toBe(spawnObserved);
  expect(apiOrigin === DEVELOPMENT_PLAN.apiOrigin).toBe(true);
});

// regression: unavailable-api-prevents-local-client-start
test('the front door retains web and diagnostics when other services fail', async () => {
  const services: DevelopmentServices = {
    postgres: null,
    openai: null,
    s3: null,
    mqtt: null,
    idp: null,
    billing: null,
    server: null,
    population: null,
    web: { origin: 'http://127.0.0.1:5428' },
    observability: {
      collectorUrl: 'http://127.0.0.1:53445/v1/traces',
      logsUrl: 'http://127.0.0.1:53445/v1/logs',
      metricsUrl: 'http://127.0.0.1:53445/v1/metrics',
      traceDir: '/retained-local-data/observability',
      tempoUrl: null,
      grafanaUrl: null,
    },
  };
  const failures: string[] = [];
  const values = await readDevelopmentServices(
    async (name) => {
      const value = services[name];
      if (value === null)
        throw new Error('Invalid mix of BigInt and other type in addition.');
      return value;
    },
    (name) => {
      failures.push(name);
    }
  );
  expect(values.web?.origin === DEVELOPMENT_PLAN.webOrigin).toBe(true);
  expect(values.observability?.traceDir).toBe(
    '/retained-local-data/observability'
  );
  expect(values.server).toBeNull();
  expect(failures).toContain('server');
  const manifest = developmentManifest(DEVELOPMENT_PLAN, values, 1_000);
  expect(manifest.webOrigin === DEVELOPMENT_PLAN.webOrigin).toBe(true);
  expect(manifest.apiOrigin).toBe(DEVELOPMENT_PLAN.apiOrigin);
  expect(manifest.apiNodes).toEqual([]);
  expect(
    manifest.observabilityTraceDir === services.observability?.traceDir
  ).toBe(true);
});
