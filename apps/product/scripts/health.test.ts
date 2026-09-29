import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFeature } from '@pkgs/gherkin/parse';
import {
  type Environment,
  HOST_LIMITS,
  hostSkips,
  parseCli,
  selectSpecs,
} from './health';

const REPO_ROOT = resolve(import.meta.dir, '../../..');

const PRODUCTION: Environment = {
  production: true,
  observability: true,
};
const STANDARD: Environment = {
  production: false,
  observability: true,
};

describe('health host limits', () => {
  test('a production environment runs every scenario', () => {
    for (const limit of HOST_LIMITS) {
      expect(hostSkips(PRODUCTION, limit.feature)).toEqual({
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

  test('every environment proves the OAuth relay returns sign-ins home', () => {
    expect(hostSkips(STANDARD, 'specs/health/sign-in.feature')).toEqual({
      wholeFeature: false,
      scenarios: [],
    });
  });

  test('request-record scenarios follow the environment', () => {
    expect(
      hostSkips(
        { ...PRODUCTION, observability: false },
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

describe('health runs features, health --objectives runs objectives', () => {
  const [feature, objective, journeys] = [
    'specs/health/api.feature',
    'specs/health/availability.openslo.yaml',
    'specs/journeys/critical-journeys.feature',
  ].map((path) => join(REPO_ROOT, path)) as [string, string, string];
  const all = [feature, objective, journeys];
  const select = (argv: readonly string[]) =>
    selectSpecs({ all, cli: parseCli(argv) });

  test('a plain run checks every feature and no objective', () => {
    expect(select([])).toEqual({
      ok: true,
      specs: [feature, journeys],
    });
  });

  test('an objectives run checks every objective and no feature', () => {
    expect(select(['--objectives'])).toEqual({ ok: true, specs: [objective] });
  });

  test("a named spec must be of the run's kind", () => {
    expect(select(['specs/health/availability.openslo.yaml'])).toEqual({
      ok: false,
      error:
        'specs/health/availability.openslo.yaml is an objective file: run it with --objectives',
    });
    expect(select(['--objectives', 'specs/health/api.feature'])).toEqual({
      ok: false,
      error: 'specs/health/api.feature is not an objective file',
    });
    expect(
      select(['--objectives', 'specs/health/availability.openslo.yaml'])
    ).toEqual({ ok: true, specs: [objective] });
  });

  test('objectives take no tags, and named specs must be live', () => {
    expect(select(['--objectives', '--tags', '@domain:health']).ok).toBe(false);
    expect(select(['specs/chess/puzzle-play.feature']).ok).toBe(false);
  });
});
