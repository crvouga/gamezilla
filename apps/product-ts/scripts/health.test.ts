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
import {
  writeFeatureStubs,
  writeSloStubs,
} from '@apps/product-ts/scripts/health';
import { parseFeature } from '@pkgs/gherkin-shared-ts/parse';
import {
  bindingIssues,
  checkObjectiveSpec,
} from '@pkgs/openslo-shared-ts/check';
import { parseOpenSlo } from '@pkgs/openslo-shared-ts/parse';
import {
  objectiveSpecStem,
  objectivesBinding,
} from '@pkgs/openslo-shared-ts/registry';
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
import { RELEASE_ENVIRONMENT, releaseSpecs } from './release-selection';

const REPO_ROOT = resolve(import.meta.dir, '../../..');

const PRODUCTION: Environment = {
  production: true,
  observability: true,
  deployment: true,
};
const STANDARD: Environment = {
  production: false,
  observability: true,
  deployment: true,
};

// regression: deploy-missing-multiplayer-release-journeys
// regression: deploy-health-escaped-pull-request
test('the release bundle checks every health journey the localhost stack can run', () => {
  const paths = releaseSpecs().map((path) => relative(REPO_ROOT, path));
  expect(paths).toContain('specs/journeys/connect-four-game.feature');
  expect(paths).toContain('specs/journeys/multiplayer-game.feature');
  expect(paths).toContain('specs/journeys/custom-game.feature');
  expect(paths).toContain('specs/journeys/join-and-offline.feature');
  expect(paths).toContain('specs/connect-four/connect-four-health.feature');
  expect(paths).toContain('specs/journeys/battleship-game.feature');
  expect(paths).toContain('specs/battleship/battleship-health.feature');
});

test('a health spec stays out of the release bundle only for something the localhost stack lacks', () => {
  const left = allSpecs()
    .filter((path) => path.endsWith('.feature'))
    .filter((path) => !releaseSpecs().includes(path));
  expect(left.length).toBeGreaterThan(0);
  for (const path of left) {
    const uri = relative(REPO_ROOT, path);
    const limit = HOST_LIMITS.find(
      (entry) => entry.feature === uri && entry.scenario === undefined
    );
    expect(
      limit,
      `${uri} is left out of the release bundle without a reason`
    ).toBeDefined();
    expect(RELEASE_ENVIRONMENT[limit?.needs ?? 'deployment']).toBe(false);
    expect(limit?.why.length).toBeGreaterThan(0);
  }
});

// regression: live-connect-four-journey-unbound
test('the live entry binds the literal Connect Four journey steps', () => {
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `
    await import('./tests/steps/live-index.ts');
    const { matchStep } = await import('@pkgs/gherkin-shared-ts/registry');
    for (const text of [
      'Alice and Bob play Connect Four from fresh devices',
      'Alice and Bob see the same completed Connect Four game'
    ]) {
      if (matchStep(text).kind !== 'match') throw new Error('unbound: ' + text);
    }
  `,
    ],
    { cwd: resolve(import.meta.dir, '..'), encoding: 'utf8' }
  );
  expect(result.status, result.stdout + result.stderr).toBe(0);
});

// regression: live-quoridor-journey-unbound
test.each(['live', 'release'])(
  'the %s entry binds the Battleship and Quoridor journey and health steps',
  (entry) => {
    const dir = mkdtempSync(join(tmpdir(), 'release-step-registration-'));
    const manifest = join(dir, 'manifest.json');
    writeFileSync(
      manifest,
      JSON.stringify({
        webOrigin: 'https://web.example.invalid',
        apiOrigin: 'https://api.example.invalid',
      })
    );
    try {
      const result = spawnSync(
        process.execPath,
        [
          '-e',
          `
    await import('./tests/steps/${entry}-index.ts');
    if (typeof document !== 'undefined') throw new Error('local DOM harness loaded');
    const { matchStep } = await import('@pkgs/gherkin-shared-ts/registry');
    const missing = [
      'Alice and Bob play Battleship from fresh devices',
      'Alice and Bob see the same completed Battleship game',
      'the team checks Battleship in this environment',
      'two people can find each other and play Battleship to a victory they both see',
      "neither person saw the other's fleet beyond what their shots showed",
      'Alice and Bob play Classic Quoridor from fresh devices',
      'Alice and Bob see the same completed Classic Quoridor game',
      'Alice and Bob play Four-Player King of the Hill with two bots from fresh devices',
      'Alice and Bob see the same completed Four-Player King of the Hill game',
      'the team checks Classic Quoridor in this environment',
      'two people can find each other and complete Classic Quoridor with the same result',
      'the team checks Four-Player King of the Hill in this environment',
      'two people and two bots can complete Four-Player King of the Hill with the same result'
    ].filter((text) => matchStep(text).kind !== 'match');
    if (missing.length > 0) throw new Error('unbound: ' + missing.join('\\n'));
  `,
        ],
        {
          cwd: resolve(import.meta.dir, '..'),
          encoding: 'utf8',
          env: { ...process.env, LOCALHOST_STACK_MANIFEST: manifest },
        }
      );
      expect(result.status, result.stdout + result.stderr).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
);

// regression: deploy-health-stale-foundation-secrets
test('health uses the post-foundation database and monitor credentials', () => {
  const liveDatabase = 'postgresql://after-foundation.example.invalid/postgres';
  const env = healthTestEnvironment({
    environment: 'prd',
    tags: '',
    vars: {
      DATABASE_URL: 'postgresql://before-foundation.example.invalid/postgres',
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
      [featureStubs, '@pkgs/gherkin-server-ts'],
      [objectiveStubs, '@pkgs/openslo-server-ts'],
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

// regression: release-journey-erases-server-trace-evidence
test('release timelines are opt-in while ordinary health keeps verdict-only reports', () => {
  const stubDir = mkdtempSync(join(tmpdir(), 'release-timeline-bridge-'));
  const dirs = { stubDir, reportDir: join(stubDir, 'report') };
  const features = [join(REPO_ROOT, 'specs/journeys/multiplayer-game.feature')];
  const sourceOf = (files: readonly string[]) =>
    readFileSync(resolve(import.meta.dir, '..', files[0]!), 'utf8');
  try {
    expect(sourceOf(writeFeatureStubs(STANDARD, features, dirs))).not.toContain(
      'wallFeatureReport'
    );
    const release = sourceOf(
      writeFeatureStubs(STANDARD, features, { ...dirs, timelineReports: true })
    );
    expect(release).toContain(
      JSON.stringify(
        Bun.resolveSync(
          '@pkgs/gherkin-server-ts/wall-reports-env',
          import.meta.dir
        )
      )
    );
    expect(release).toContain(
      `report: wallFeatureReport(${JSON.stringify(dirs.reportDir)})`
    );
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
    "import '../tests/steps/index';\nimport { createS3ObjectStore } from '@pkgs/object-store-s3-server-ts/impl-s3';\nimport { expect, test } from 'bun:test';\ntest('live entry and S3 transport load', () => {\n  expect(process.env['SECRETS_ENV']).toBe('dev');\n  expect(createS3ObjectStore({ endpoint: 'http://127.0.0.1:1', bucket: 'health-loader', region: 'us-east-1', accessKeyId: 'local', secretAccessKey: 'local', rootPrefix: 'health-loader/', http: { fetch: async () => { throw new Error('constructing a transport cannot request HTTP'); } } })).toBeDefined();\n});\n"
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
    expect(select(['specs/games/puzzle-play.feature']).ok).toBe(false);
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
    expect(specs).toContain('specs/runtime/request-success.openslo.yaml');
    expect(specs).toContain('specs/runtime/request-speed.openslo.yaml');
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
    developer.indexOf("import '@pkgs/bun-test-solid-client-ts/preload'")
  ).toBeLessThan(developer.indexOf('import { openHarness }'));
  expect(local).toContain("import './live-index'");
  expect(live).toContain('useLiveWorld()');
  expect(live).not.toContain('@pkgs/bun-test-solid-client-ts/preload');
  expect(live).not.toContain('@libs/harness-ts/');
});

describe('the live objectives', () => {
  const objectives = () =>
    allSpecs().filter((path) => path.endsWith('.openslo.yaml'));

  test('each has a binding that measures exactly its indicators', async () => {
    await import('./../tests/openslo/index');
    expect(objectives().length).toBeGreaterThanOrEqual(3);
    for (const path of objectives()) {
      const parsed = parseOpenSlo(readFileSync(path, 'utf8'));
      if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
      expect(
        bindingIssues(parsed.doc, objectivesBinding(objectiveSpecStem(path)))
      ).toEqual([]);
    }
  });

  // regression: availability-objective-measured-from-ci-history-only
  test('a deployment whose metrics cannot be read fails every objective by name, never passes', async () => {
    await import('./../tests/openslo/index');
    const names = [
      'OBS_PROMETHEUS_URL',
      'OBS_PROMETHEUS_USER',
      'OBS_TEMPO_TOKEN',
    ] as const;
    const kept = names.map((name) => [name, process.env[name]] as const);
    for (const name of names) delete process.env[name];
    try {
      for (const stem of ['request-success', 'request-speed']) {
        const path = join(REPO_ROOT, `specs/runtime/${stem}.openslo.yaml`);
        const checked = await checkObjectiveSpec({
          text: readFileSync(path, 'utf8'),
          binding: objectivesBinding(stem),
        });
        expect(checked.issues).toEqual([]);
        expect(checked.results.length).toBeGreaterThan(0);
        for (const result of checked.results) {
          expect(result.evaluation.met).toBe(false);
          expect(result.evaluation.detail).toContain(
            'OBS_PROMETHEUS_URL, OBS_PROMETHEUS_USER, OBS_TEMPO_TOKEN are not set'
          );
        }
      }
    } finally {
      for (const [name, value] of kept) {
        if (value !== undefined) process.env[name] = value;
      }
    }
  });
});
