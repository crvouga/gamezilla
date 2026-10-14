import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { writeFeatureStubs, writeSloStubs } from '@apps/product/scripts/health';
import { parseFeature } from '@pkgs/gherkin-shared/parse';
import type { Environment } from './health';
import {
  allSpecs,
  HOST_LIMITS,
  healthTestArguments,
  healthTestEnvironment,
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

// regression: deploy-health-stale-foundation-secrets
test('health uses the post-foundation database and monitor credentials', () => {
  const liveDatabase = 'postgresql://role:new@aws.connect.psdb.cloud/postgres';
  const env = healthTestEnvironment({
    environment: 'prd',
    tags: '',
    vars: {
      DATABASE_URL:
        'postgresql://owner:old@ep-fancy-dream.us-east-1.aws.neon.tech/neondb',
      SYNTHETIC_MONITOR_TOKEN: 'before-foundation',
      BUN_CHROME_PATH: '/chrome',
    },
    secrets: new Map([
      ['DATABASE_URL', liveDatabase],
      ['SYNTHETIC_MONITOR_TOKEN', 'after-foundation'],
    ]),
  });
  expect(env['DATABASE_URL']).toBe(liveDatabase);
  expect(env['SYNTHETIC_MONITOR_TOKEN']).toBe('after-foundation');
  expect(env['BUN_CHROME_PATH']).toBe('/chrome');
  expect(env['SECRETS_ENV']).toBe('prd');
});

// regression: health-stale-spec-bridge-paths
test('health generates feature and objective stubs with resolvable declared bridges', () => {
  const stubDir = mkdtempSync(join(tmpdir(), 'health-spec-bridges-'));
  const dirs = { stubDir, reportDir: join(stubDir, 'report') };
  try {
    const featureStubs = writeFeatureStubs(
      STANDARD,
      [join(REPO_ROOT, 'specs/runtime/serving-people.feature')],
      dirs
    );
    const objectiveStubs = writeSloStubs(
      [join(REPO_ROOT, 'specs/runtime/availability.openslo.yaml')],
      dirs
    );
    const manifest = JSON.parse(
      readFileSync(join(import.meta.dir, '../package.json'), 'utf8')
    ) as { readonly devDependencies: Readonly<Record<string, string>> };
    for (const [stubs, packageName] of [
      [featureStubs, '@pkgs/gherkin-server'],
      [objectiveStubs, '@pkgs/openslo-server'],
    ] as const) {
      expect(stubs).toHaveLength(1);
      const source = readFileSync(
        resolve(import.meta.dir, '..', stubs[0] ?? ''),
        'utf8'
      );
      expect(source).toContain(
        JSON.stringify(
          Bun.resolveSync(`${packageName}/bun-test`, import.meta.dir)
        )
      );
      expect(manifest.devDependencies[packageName]).toBe('workspace:*');
    }
  } finally {
    rmSync(stubDir, { recursive: true, force: true });
  }
});

// regression: multiplayer-journey-parameter-registration
// regression: custom-game-journey-parameter-registration
test('health loads its live entry and constructs the real S3 transport', () => {
  // regression: health-solid-preload-after-imports
  // regression: health-browser-conditions-break-s3
  // regression: health-environment-name-not-forwarded
  const fixture = resolve(
    import.meta.dir,
    '../.cache/health-loader-regression.test.ts'
  );
  mkdirSync(resolve(import.meta.dir, '../.cache'), { recursive: true });
  writeFileSync(
    fixture,
    "import '../tests/steps/index';\nimport { createS3ObjectStore } from '@pkgs/object-store-s3-server/impl-s3';\nimport { expect, test } from 'bun:test';\ntest('live entry and S3 transport load', () => {\n  expect(process.env['SECRETS_ENV']).toBe('dev');\n  expect(createS3ObjectStore({ endpoint: 'http://127.0.0.1:1', bucket: 'health-loader', region: 'us-east-1', accessKeyId: 'local', secretAccessKey: 'local', rootPrefix: 'health-loader/', http: { fetch: async () => { throw new Error('constructing a transport cannot request HTTP'); } } })).toBeDefined();\n});\n"
  );
  try {
    const result = spawnSync(
      process.execPath,
      healthTestArguments(parseCli([]), [fixture]),
      {
        cwd: resolve(import.meta.dir, '..'),
        encoding: 'utf8',
        env: healthTestEnvironment({
          environment: 'dev',
          tags: '',
          vars: { ...process.env, SECRETS_ENV: undefined },
          secrets: new Map(),
        }),
      }
    );
    expect({
      code: result.status,
      output: result.stdout + result.stderr,
    }).toMatchObject({ code: 0 });
  } finally {
    rmSync(fixture);
  }
});

// regression: health-solid-preload-order
// regression: health-journeys-share-monitor-account
test('live health runs server adapters without the local DOM harness conditions', () => {
  const stub = '.cache/spec-live/runtime-stored-files.feature.test.ts';
  const args = healthTestArguments(parseCli(['--bail']), [stub]);
  expect(args).toEqual([
    'test',
    '--timeout',
    '900000',
    '--max-concurrency',
    '1',
    '--bail',
    stub,
  ]);
  const health = readFileSync(join(import.meta.dir, 'health.ts'), 'utf8');
  expect(health).toContain("'tests/steps/live-index.ts'");
});

// regression: health-journeys-share-monitor-account
test('live feature files use one runner for the shared monitor', () => {
  const dir = mkdtempSync(join(tmpdir(), 'health-monitor-'));
  const runners = join(dir, 'runners.txt');
  const fixtures = ['host-space', 'join-from-link'].map((scenario) => {
    const file = join(dir, `${scenario}.test.ts`);
    writeFileSync(
      file,
      `
import { test } from 'bun:test';
import { appendFileSync } from 'node:fs';
test(${JSON.stringify(scenario)}, async () => {
  appendFileSync(${JSON.stringify(runners)}, String(process.pid) + '\\n');
  for (let turn = 0; turn < 500_000; turn++) await Promise.resolve();
});
`
    );
    return file;
  });
  try {
    const result = spawnSync(
      process.execPath,
      healthTestArguments(parseCli([]), fixtures),
      { encoding: 'utf8' }
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toContain('2 pass');
    const processes = readFileSync(runners, 'utf8').trim().split('\n');
    expect(processes).toHaveLength(2);
    expect(new Set(processes).size).toBe(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

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

// regression: health-ui-step-loader-order
test('live health avoids local UI steps while local specs preload the macro loader', () => {
  const local = readFileSync(
    join(import.meta.dir, '../tests/steps/index.ts'),
    'utf8'
  );
  const developer = readFileSync(
    join(import.meta.dir, '../tests/steps/developer-world.ts'),
    'utf8'
  );
  const live = readFileSync(
    join(import.meta.dir, '../tests/steps/live-index.ts'),
    'utf8'
  );
  expect(
    developer.indexOf("import '@pkgs/bun-test-solid-client/preload'")
  ).toBeLessThan(developer.indexOf('import { openHarness }'));
  expect(local).toContain("import './live-index'");
  expect(live).toContain('useLiveWorld()');
  expect(live).not.toContain('@pkgs/bun-test-solid-client/preload');
  expect(live).not.toContain('@libs/harness/');
});
