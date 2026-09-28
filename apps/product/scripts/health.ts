#!/usr/bin/env bun
// @io-wall-ok — CLI: `@apps/product#health`, the live health of one environment.
/**
 * Runs every feature of this package's `liveDomains` (`specs/health/`,
 * `specs/journeys/`) against the environment `SECRETS_ENV` names — its
 * Workers, database, bucket, broker, secrets and infrastructure, and the
 * critical journeys in a real browser. The last step of every deploy and the
 * Health workflow's schedule. Every decided scenario is recorded as `release`
 * evidence in `.cache/health-report/evidence/`.
 *
 * `--objectives` (`health:objectives`) instead checks every service level
 * objective of those domains (`*.openslo.yaml`, through
 * `tests/openslo/index.ts`) for that environment, recording `release`
 * evidence in `.cache/health-objectives-report/evidence/`. Objectives are
 * measured over weeks, so a run of them never gates a deploy: the Health
 * workflow runs them after the environments' checks, and a plain `health`
 * (what `//#deploy` depends on) never runs them.
 *
 * The environment picks the scenarios: `HOST_LIMITS` names the features and
 * scenarios an environment cannot run. Specs never say where they run
 * (specs/README.md D1), so that knowledge lives here, beside the
 * bindings.
 *
 *   health                                              every feature
 *   health specs/health/sign-in.feature                 one feature (repo-relative)
 *   health --tags '@domain:journeys'                    features narrowed by tags
 *   health --objectives                                 every objective file
 *   health --objectives specs/health/availability.openslo.yaml   one objective file
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
const STEPS_ENTRY = join(PACKAGE_DIR, 'tests/steps/index.ts');
const SLO_ENTRY = join(PACKAGE_DIR, 'tests/openslo/index.ts');
const FEATURE_SUFFIX = '.feature';
const SLO_SUFFIX = '.openslo.yaml';
/** Per scenario: a broker built from scratch gets ten minutes to come up. */
const SCENARIO_TIMEOUT_MS = 15 * 60 * 1000;

/** Where a run of each kind writes its stubs and its report bucket. */
type RunDirs = { readonly stubDir: string; readonly reportDir: string };

const FEATURE_DIRS: RunDirs = {
  stubDir: join(PACKAGE_DIR, '.cache/spec-live'),
  reportDir: join(PACKAGE_DIR, '.cache/health-report'),
};
const OBJECTIVE_DIRS: RunDirs = {
  stubDir: join(PACKAGE_DIR, '.cache/spec-live-objectives'),
  reportDir: join(PACKAGE_DIR, '.cache/health-objectives-report'),
};

type Cli = {
  /** `.feature` and `.openslo.yaml` paths, as given. */
  readonly specPaths: readonly string[];
  readonly tags: string | undefined;
  /** `--objectives`: run the objective files instead of the features. */
  readonly objectives: boolean;
  readonly bunArgs: readonly string[];
};

export function parseCli(argv: readonly string[]): Cli {
  const specPaths: string[] = [];
  const bunArgs: string[] = [];
  let tags: string | undefined;
  let objectives = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--objectives') objectives = true;
    else if (arg === '--tags') tags = argv[++i];
    else if (arg.startsWith('--tags=')) tags = arg.slice('--tags='.length);
    else if (arg.endsWith(FEATURE_SUFFIX) || arg.endsWith(SLO_SUFFIX))
      specPaths.push(arg);
    else bunArgs.push(arg);
  }
  return { specPaths, tags, objectives, bunArgs };
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
    return [`*${FEATURE_SUFFIX}`, `*${SLO_SUFFIX}`]
      .flatMap((glob) => [...new Bun.Glob(glob).scanSync({ cwd: dir })])
      .sort()
      .map((file) => join(dir, file));
  });
}

export type Selection =
  | { readonly ok: true; readonly specs: readonly string[] }
  | { readonly ok: false; readonly error: string };

/**
 * What a run checks. A plain run checks features, `--objectives` objective
 * files, never both: the specs named (each of the run's kind and in a live
 * domain), else every one of the kind. Objectives carry no tags.
 */
export function selectSpecs(input: {
  /** Every spec of the live domains, absolute. */
  readonly all: readonly string[];
  readonly cli: Cli;
}): Selection {
  const { all, cli } = input;
  const suffix = cli.objectives ? SLO_SUFFIX : FEATURE_SUFFIX;
  if (cli.objectives && cli.tags !== undefined) {
    return {
      ok: false,
      error: '--objectives takes no --tags (objectives carry no tags)',
    };
  }
  if (cli.specPaths.length === 0) {
    return { ok: true, specs: all.filter((path) => path.endsWith(suffix)) };
  }
  const specs: string[] = [];
  for (const given of cli.specPaths) {
    const abs = resolve(REPO_ROOT, given);
    if (!all.includes(abs)) {
      return { ok: false, error: `${given} is not a spec of liveDomains` };
    }
    if (!abs.endsWith(suffix)) {
      const error = cli.objectives
        ? `${given} is not an objective file`
        : `${given} is an objective file: run it with --objectives`;
      return { ok: false, error };
    }
    specs.push(abs);
  }
  return { ok: true, specs };
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

/** Fresh stub and report directories for a run of one kind. */
function freshDirs(dirs: RunDirs): void {
  for (const dir of [dirs.stubDir, dirs.reportDir]) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }
}

function writeFeatureStubs(
  env: Environment,
  features: readonly string[]
): readonly string[] {
  const { stubDir, reportDir } = FEATURE_DIRS;
  const bridge = Bun.resolveSync('@pkgs/gherkin/bun-test', import.meta.dir);
  return features.flatMap((featurePath) => {
    const featureUri = relative(REPO_ROOT, featurePath);
    const skips = hostSkips(env, featureUri);
    if (skips.wholeFeature) return [];
    const file = join(stubDir, stubFileName(featureUri));
    writeFileSync(
      file,
      stubSource({
        packageName: '@apps/product',
        featurePath,
        featureUri,
        stepsEntry: STEPS_ENTRY,
        bridge,
        skip: skips.scenarios,
        reportDir,
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
  const { stubDir, reportDir } = OBJECTIVE_DIRS;
  const bridge = Bun.resolveSync('@pkgs/openslo/bun-test', import.meta.dir);
  return objectives.map((specPath) => {
    const specUri = relative(REPO_ROOT, specPath);
    const file = join(stubDir, sloStubFileName(specUri));
    writeFileSync(
      file,
      sloStubSource({
        packageName: '@apps/product',
        specPath,
        specUri,
        entry: SLO_ENTRY,
        bridge,
        reportDir,
      })
    );
    return `./${relative(PACKAGE_DIR, file)}`;
  });
}

function environmentOffers(): {
  readonly name: string;
  readonly offers: Environment;
} {
  const env = envFile(process.env['SECRETS_ENV']?.trim() || 'dev');
  return {
    name: env.env,
    offers: {
      production: isProductionEnv(env),
      observability:
        (process.env['OBSERVABILITY_ENABLED'] ?? '').trim() !== '0',
    },
  };
}

function writeStubs(cli: Cli, offers: Environment): readonly string[] {
  const selection = selectSpecs({ all: allSpecs(), cli });
  if (!selection.ok) {
    console.error(`health: ${selection.error} (${liveDomains().join(', ')})`);
    process.exit(1);
  }
  freshDirs(cli.objectives ? OBJECTIVE_DIRS : FEATURE_DIRS);
  return cli.objectives
    ? writeSloStubs(selection.specs)
    : writeFeatureStubs(offers, selection.specs);
}

if (import.meta.main) {
  const cli = parseCli(process.argv.slice(2));
  const { name, offers } = environmentOffers();
  const tags = cli.tags ?? '';
  const missing = (Object.keys(offers) as (keyof Environment)[]).filter(
    (need) => !offers[need]
  );
  console.log(
    `health${cli.objectives ? ' objectives' : ''}: ${name}${missing.length > 0 ? ` — without ${missing.join(', ')}` : ''}${tags.length > 0 ? ` — ${tags}` : ''}`
  );
  const stubs = writeStubs(cli, offers);
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
