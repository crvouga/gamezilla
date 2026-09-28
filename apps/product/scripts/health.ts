#!/usr/bin/env bun
// @io-wall-ok — CLI: `@apps/product#health`, the live health of one environment.
/**
 * Runs every feature of this package's `liveDomains` (`specs/health/`,
 * `specs/journeys/`) against the environment `SECRETS_ENV` names — its
 * Workers, database, bucket, broker, secrets and infrastructure, and the
 * critical journeys in a real browser — and checks every service level
 * objective of those domains (`*.openslo.yaml`, through
 * `tests/openslo/index.ts`). The last step of every deploy and the Health
 * workflow's schedule. Every decided scenario and objective is recorded as
 * `release` evidence in `.cache/health-report/evidence/`.
 *
 * The environment picks the scenarios: `HOST_LIMITS` names the features and
 * scenarios an environment cannot run. Specs never say where they run
 * (specs/README.md D1), so that knowledge lives here, beside the
 * bindings.
 *
 *   health                                     everything
 *   health specs/health/sign-in.feature        one feature (repo-relative)
 *   health specs/health/api.openslo.yaml       one objective file
 *   health --tags '@domain:journeys'           features narrowed by tags
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { isProductionEnv } from '@libs/infra/public/env-file';
import { envFile } from '@libs/infra/public/envs';
import { stubFileName, stubSource } from '@pkgs/gherkin/stubs';
import { sloStubFileName, sloStubSource } from '@pkgs/openslo/stubs';

const PACKAGE_DIR = resolve(import.meta.dir, '..');
const REPO_ROOT = resolve(PACKAGE_DIR, '../..');
const STUB_DIR = join(PACKAGE_DIR, '.cache/spec-live');
const STEPS_ENTRY = join(PACKAGE_DIR, 'tests/steps/index.ts');
const SLO_ENTRY = join(PACKAGE_DIR, 'tests/openslo/index.ts');
const REPORT_DIR = join(PACKAGE_DIR, '.cache/health-report');
const SLO_SUFFIX = '.openslo.yaml';
/** Per scenario: a broker built from scratch gets ten minutes to come up. */
const SCENARIO_TIMEOUT_MS = 15 * 60 * 1000;

type Cli = {
  /** `.feature` and `.openslo.yaml` paths, as given. */
  readonly featurePaths: readonly string[];
  readonly tags: string | undefined;
  readonly bunArgs: readonly string[];
};

function parseCli(argv: readonly string[]): Cli {
  const featurePaths: string[] = [];
  const bunArgs: string[] = [];
  let tags: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--tags') tags = argv[++i];
    else if (arg.startsWith('--tags=')) tags = arg.slice('--tags='.length);
    else if (arg.endsWith('.feature') || arg.endsWith(SLO_SUFFIX))
      featurePaths.push(arg);
    else bunArgs.push(arg);
  }
  return { featurePaths, tags, bunArgs };
}

function liveDomains(): readonly string[] {
  const manifest = JSON.parse(
    readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8')
  ) as { readonly liveDomains?: readonly string[] };
  return manifest.liveDomains ?? [];
}

/** Every feature and objective file of the live domains (absolute). */
function allSpecs(): readonly string[] {
  return liveDomains().flatMap((domain) => {
    const dir = join(REPO_ROOT, 'specs', domain);
    if (!existsSync(dir)) return [];
    return ['*.feature', `*${SLO_SUFFIX}`]
      .flatMap((glob) => [...new Bun.Glob(glob).scanSync({ cwd: dir })])
      .sort()
      .map((file) => join(dir, file));
  });
}

/**
 * The specs named, else every feature — and every objective unless `--tags`
 * narrows the run to scenarios (objectives carry no tags).
 */
function selectSpecs(cli: Cli): readonly string[] {
  const all = allSpecs();
  if (cli.featurePaths.length === 0) {
    return cli.tags === undefined
      ? all
      : all.filter((path) => path.endsWith('.feature'));
  }
  return cli.featurePaths.map((given) => {
    const abs = resolve(REPO_ROOT, given);
    if (!all.includes(abs)) {
      console.error(
        `health: ${given} is not in liveDomains (${liveDomains().join(', ')})`
      );
      process.exit(1);
    }
    return abs;
  });
}

/** What an environment offers that some scenarios need. */
export type Environment = {
  readonly production: boolean;
  readonly observability: boolean;
};

/**
 * A feature (or one scenario of it) only an environment with `needs` can run.
 * Keyed by the feature's repo-relative path and the scenario's name; a test
 * checks every entry still names a real feature and scenario.
 */
export type HostLimit = {
  readonly feature: string;
  readonly scenario?: string;
  readonly needs: keyof Environment;
  readonly why: string;
};

export const HOST_LIMITS: readonly HostLimit[] = [
  {
    feature: 'specs/journeys/critical-journeys.feature',
    needs: 'production',
    why: 'the critical journeys drive a real browser against the production web app',
  },
  {
    feature: 'specs/health/payments.feature',
    scenario: 'People can pay for Plus in production',
    needs: 'production',
    why: 'only production takes real payments',
  },
  {
    feature: 'specs/health/request-records.feature',
    needs: 'observability',
    why: 'with OBSERVABILITY_ENABLED=0 the environment keeps no request records',
  },
];

/** What `env` cannot run in `featureUri`: the whole feature, or some scenarios. */
export function hostSkips(
  env: Environment,
  featureUri: string
): { readonly wholeFeature: boolean; readonly scenarios: readonly string[] } {
  const limits = HOST_LIMITS.filter(
    (limit) => limit.feature === featureUri && !env[limit.needs]
  );
  return {
    wholeFeature: limits.some((limit) => limit.scenario === undefined),
    scenarios: limits.flatMap((limit) =>
      limit.scenario === undefined ? [] : [limit.scenario]
    ),
  };
}

function writeStubs(
  env: Environment,
  specs: readonly string[]
): readonly string[] {
  rmSync(STUB_DIR, { recursive: true, force: true });
  mkdirSync(STUB_DIR, { recursive: true });
  const features = specs.filter((path) => path.endsWith('.feature'));
  const objectives = specs.filter((path) => path.endsWith(SLO_SUFFIX));
  return [...writeFeatureStubs(env, features), ...writeSloStubs(objectives)];
}

function writeFeatureStubs(
  env: Environment,
  features: readonly string[]
): readonly string[] {
  const bridge = Bun.resolveSync('@pkgs/gherkin/bun-test', import.meta.dir);
  return features.flatMap((featurePath) => {
    const featureUri = relative(REPO_ROOT, featurePath);
    const skips = hostSkips(env, featureUri);
    if (skips.wholeFeature) return [];
    const file = join(STUB_DIR, stubFileName(featureUri));
    writeFileSync(
      file,
      stubSource({
        packageName: '@apps/product',
        featurePath,
        featureUri,
        stepsEntry: STEPS_ENTRY,
        bridge,
        skip: skips.scenarios,
        reportDir: REPORT_DIR,
        layer: 'release',
      })
    );
    return [`./${relative(PACKAGE_DIR, file)}`];
  });
}

function writeSloStubs(objectives: readonly string[]): readonly string[] {
  if (objectives.length === 0) return [];
  if (!existsSync(SLO_ENTRY)) {
    console.error(
      `health: ${relative(PACKAGE_DIR, SLO_ENTRY)} is missing — liveDomains hold OpenSLO objectives, so an entry must import one tests/openslo/<stem>.binding.ts per objective file (each with spec: '<stem>')`
    );
    process.exit(1);
  }
  const bridge = Bun.resolveSync('@pkgs/openslo/bun-test', import.meta.dir);
  return objectives.map((specPath) => {
    const specUri = relative(REPO_ROOT, specPath);
    const file = join(STUB_DIR, sloStubFileName(specUri));
    writeFileSync(
      file,
      sloStubSource({
        packageName: '@apps/product',
        specPath,
        specUri,
        entry: SLO_ENTRY,
        bridge,
        reportDir: REPORT_DIR,
      })
    );
    return `./${relative(PACKAGE_DIR, file)}`;
  });
}

if (import.meta.main) {
  const cli = parseCli(process.argv.slice(2));
  const env = envFile(process.env['SECRETS_ENV']?.trim() || 'dev');
  const offers: Environment = {
    production: isProductionEnv(env),
    observability: (process.env['OBSERVABILITY_ENABLED'] ?? '').trim() !== '0',
  };
  const tags = cli.tags ?? '';
  const missing = (Object.keys(offers) as (keyof Environment)[]).filter(
    (need) => !offers[need]
  );
  console.log(
    `health: ${env.env}${missing.length > 0 ? ` — without ${missing.join(', ')}` : ''}${tags.length > 0 ? ` — ${tags}` : ''}`
  );
  rmSync(REPORT_DIR, { recursive: true, force: true });
  mkdirSync(REPORT_DIR, { recursive: true });
  const stubs = writeStubs(offers, selectSpecs(cli));
  if (stubs.length === 0) {
    console.error('health: nothing to run');
    process.exit(1);
  }
  const result = spawnSync(
    'bun',
    [
      'test',
      '--timeout',
      String(SCENARIO_TIMEOUT_MS),
      '--parallel',
      ...cli.bunArgs,
      ...stubs,
    ],
    {
      cwd: PACKAGE_DIR,
      stdio: 'inherit',
      env: { ...process.env, SPEC_TAGS: tags },
    }
  );
  process.exit(result.status ?? 1);
}
