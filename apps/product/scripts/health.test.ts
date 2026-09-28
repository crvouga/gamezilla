import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFeature } from '@pkgs/gherkin/parse';
import { type Environment, HOST_LIMITS, hostSkips } from './health';

const REPO_ROOT = resolve(import.meta.dir, '../../..');

const PRODUCTION_RELAY: Environment = {
  production: true,
  relay: true,
  observability: true,
};
const STANDARD: Environment = {
  production: false,
  relay: false,
  observability: true,
};

describe('health host limits', () => {
  test('a production relay environment runs every scenario', () => {
    for (const limit of HOST_LIMITS) {
      expect(hostSkips(PRODUCTION_RELAY, limit.feature)).toEqual({
        wholeFeature: false,
        scenarios: [],
      });
    }
  });

  test('critical journeys and live payments run only in production', () => {
    expect(
      hostSkips(STANDARD, 'specs/journeys/critical-journeys.feature')
        .wholeFeature
    ).toBe(true);
    expect(hostSkips(STANDARD, 'specs/health/payments.feature')).toEqual({
      wholeFeature: false,
      scenarios: ['People can pay for Plus in production'],
    });
    expect(hostSkips(STANDARD, 'specs/health/spaces.feature')).toEqual({
      wholeFeature: false,
      scenarios: [],
    });
  });

  test('relay and request-record scenarios follow the environment', () => {
    expect(
      hostSkips(STANDARD, 'specs/health/sign-in.feature').scenarios
    ).toEqual(['Google sign-ins started in another environment return to it']);
    expect(
      hostSkips(
        { ...PRODUCTION_RELAY, observability: false },
        'specs/health/request-records.feature'
      ).wholeFeature
    ).toBe(true);
  });

  test('every limit names a feature and scenario that exist', () => {
    for (const limit of HOST_LIMITS) {
      const source = readFileSync(join(REPO_ROOT, limit.feature), 'utf8');
      const names = parseFeature(source, limit.feature).scenarios.map(
        (s) => s.name
      );
      expect(names.length).toBeGreaterThan(0);
      if (limit.scenario !== undefined) expect(names).toContain(limit.scenario);
    }
  });
});
