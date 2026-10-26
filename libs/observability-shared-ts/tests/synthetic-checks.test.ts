// @io-wall-ok — reads the committed live features to compare with the check vocabulary.
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkOfFeature,
  checkResults,
  checkResultsRequest,
  metricsEndpoint,
  SYNTHETIC_CHECKS,
} from '@libs/observability-shared-ts/synthetic-checks';
import { isSyntheticFeatureSource } from '@pkgs/gherkin-shared-ts/tags';
import { REPO_ROOT } from './specs';

/** What a health run runs: every feature of the live domains and every `@synthetic` one. */
function liveFeatures(): readonly string[] {
  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, 'apps/product-ts/package.json'), 'utf8')
  ) as { readonly liveDomains?: readonly string[] };
  const liveDomains = new Set(manifest.liveDomains ?? []);
  const specs = join(REPO_ROOT, 'specs');
  return readdirSync(specs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((domain) =>
      readdirSync(join(specs, domain.name))
        .filter((file) => file.endsWith('.feature'))
        .map((file) => `specs/${domain.name}/${file}`)
        .filter(
          (uri) =>
            liveDomains.has(domain.name) ||
            isSyntheticFeatureSource(readFileSync(join(REPO_ROOT, uri), 'utf8'))
        )
    )
    .sort();
}

describe('the check names', () => {
  test('name exactly the features a health run runs', () => {
    const named = liveFeatures().map(checkOfFeature);
    expect(named).not.toContain(null);
    expect([...named].sort()).toEqual([...SYNTHETIC_CHECKS].sort());
  });

  test('read a feature path, and nothing else', () => {
    expect(checkOfFeature('specs/auth/sign-in.feature')).toBe('auth.sign-in');
    expect(checkOfFeature('specs/auth/sign-in.openslo.yaml')).toBeNull();
    expect(checkOfFeature('specs/auth/not-a-check.feature')).toBeNull();
  });
});

describe("a run's results", () => {
  test('pass a feature only when it decided scenarios and all of them passed', () => {
    expect(
      checkResults([
        {
          featureUri: 'specs/auth/sign-in.feature',
          statuses: ['pass', 'pass'],
        },
        {
          featureUri: 'specs/spaces/spaces.feature',
          statuses: ['pass', 'fail'],
        },
        { featureUri: 'specs/spaces/live-updates.feature', statuses: [] },
      ])
    ).toEqual([
      { check: 'auth.sign-in', passed: true },
      { check: 'spaces.spaces', passed: false },
      { check: 'spaces.live-updates', passed: false },
    ]);
  });

  test('refuse a live feature with no check name, so it cannot go unmeasured', () => {
    expect(() =>
      checkResults([
        { featureUri: 'specs/auth/new.feature', statuses: ['pass'] },
      ])
    ).toThrow('add it to SYNTHETIC_CHECKS');
  });

  test('become one gauge point per check, stamped with the environment', () => {
    const request = checkResultsRequest({
      results: [
        { check: 'auth.sign-in', passed: true },
        { check: 'spaces.spaces', passed: false },
      ],
      environment: 'prd',
      atMs: 1_790_000_000_123,
      version: 'abc',
    }) as {
      resourceMetrics: {
        scopeMetrics: {
          metrics: {
            name: string;
            gauge: {
              dataPoints: {
                attributes: { key: string; value: { stringValue: string } }[];
                timeUnixNano: string;
                asDouble: number;
              }[];
            };
          }[];
        }[];
      }[];
    };
    const metric = request.resourceMetrics[0]?.scopeMetrics[0]?.metrics[0];
    expect(metric?.name).toBe('synthetic.check.result');
    expect(
      metric?.gauge.dataPoints.map((p) => [
        p.attributes.map((a) => `${a.key}=${a.value.stringValue}`),
        p.timeUnixNano,
        p.asDouble,
      ])
    ).toEqual([
      [
        ['app.synthetic.check=auth.sign-in', 'deployment.environment.name=prd'],
        '1790000000123000000',
        1,
      ],
      [
        [
          'app.synthetic.check=spaces.spaces',
          'deployment.environment.name=prd',
        ],
        '1790000000123000000',
        0,
      ],
    ]);
  });

  test('go to the collector metrics endpoint beside its traces one', () => {
    expect(metricsEndpoint('https://otlp-gateway.example/otlp/v1/traces')).toBe(
      'https://otlp-gateway.example/otlp/v1/metrics'
    );
    expect(metricsEndpoint('https://otlp-gateway.example/otlp/')).toBe(
      'https://otlp-gateway.example/otlp/v1/metrics'
    );
  });
});
