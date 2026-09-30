import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseFeature } from '@pkgs/gherkin/parse';
import {
  allSpecs,
  type Environment,
  HOST_LIMITS,
  hostSkips,
  parseCli,
  scopedSpecs,
  selectSpecs,
  targetEnv,
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
    expect(hostSkips(STANDARD, 'specs/billing/payments.feature')).toEqual({
      wholeFeature: false,
      scenarios: ['People can pay for Plus in production'],
    });
    expect(hostSkips(STANDARD, 'specs/spaces/spaces.feature')).toEqual({
      wholeFeature: false,
      scenarios: [],
    });
  });

  test('every environment proves the OAuth relay returns sign-ins home', () => {
    expect(hostSkips(STANDARD, 'specs/auth/sign-in.feature')).toEqual({
      wholeFeature: false,
      scenarios: [],
    });
  });

  test('request-record scenarios follow the environment', () => {
    expect(
      hostSkips(
        { ...PRODUCTION, observability: false },
        'specs/runtime/request-records.feature'
      ).wholeFeature
    ).toBe(true);
    expect(
      hostSkips(
        { ...PRODUCTION, observability: false },
        'specs/profile/finding-a-person.feature'
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
    'specs/runtime/serving-people.feature',
    'specs/runtime/availability.openslo.yaml',
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
    expect(select(['specs/runtime/availability.openslo.yaml'])).toEqual({
      ok: false,
      error:
        'specs/runtime/availability.openslo.yaml is an objective file: run it with --objectives',
    });
    expect(
      select(['--objectives', 'specs/runtime/serving-people.feature'])
    ).toEqual({
      ok: false,
      error: 'specs/runtime/serving-people.feature is not an objective file',
    });
    expect(
      select(['--objectives', 'specs/runtime/availability.openslo.yaml'])
    ).toEqual({ ok: true, specs: [objective] });
  });

  test('objectives take no tags, and named specs must be live', () => {
    expect(select(['--objectives', '--tags', '@synthetic']).ok).toBe(false);
    expect(select(['specs/chess/puzzle-play.feature']).ok).toBe(false);
  });
});

describe('synthetic discovery', () => {
  const uri = (path: string) => relative(REPO_ROOT, path);

  test('a live run sees journeys, every synthetic feature, and the live objective', () => {
    const specs = allSpecs().map(uri);
    expect(specs).toContain('specs/journeys/critical-journeys.feature');
    expect(specs).toContain('specs/runtime/reaching-the-app.feature');
    expect(specs).toContain('specs/auth/sign-in.feature');
    expect(specs).toContain('specs/billing/payments.feature');
    expect(specs).toContain('specs/spaces/spaces.feature');
    expect(specs).toContain('specs/spaces/live-updates.feature');
    expect(specs).toContain('specs/profile/finding-a-person.feature');
    expect(specs).toContain('specs/runtime/availability.openslo.yaml');
    expect(specs.some((path) => path.startsWith('specs/health/'))).toBe(false);
  });

  test('--synthetic keeps tagged features and drops journeys and objectives', () => {
    const specs = scopedSpecs(parseCli(['--synthetic'])).map(uri);
    expect(specs).toContain('specs/runtime/serving-people.feature');
    expect(specs).not.toContain('specs/journeys/critical-journeys.feature');
    expect(specs).not.toContain('specs/runtime/availability.openslo.yaml');
    expect(specs.every((path) => path.endsWith('.feature'))).toBe(true);
  });

  test('target aliases and the synthetic flag', () => {
    expect(targetEnv('dev')).toBe('dev');
    expect(targetEnv('test')).toBe('dev');
    expect(targetEnv('prd')).toBe('prd');
    expect(targetEnv('production')).toBe('prd');
    expect(targetEnv('staging')).toBeNull();
    expect(parseCli(['--synthetic', '--target', 'production'])).toMatchObject({
      synthetic: true,
      objectives: false,
      target: 'production',
    });
    expect(parseCli(['--target=test']).target).toBe('test');
  });
});
