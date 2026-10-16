#!/usr/bin/env bun
// @io-wall-ok — CLI: `@apps/product#health`, the live health of one environment.
/**
 * Runs this package's `liveDomains` (`specs/journeys/`) and every
 * `@synthetic` feature, wherever it sits, against the environment
 * `SECRETS_ENV` names — its Workers, database, bucket, broker, secrets and
 * infrastructure, and the critical journeys in a real browser. `--synthetic`
 * runs only the `@synthetic` features. The last step of every deploy and the
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
 *   health                                              journeys and @synthetic features
 *   health --synthetic                                  @synthetic features only
 *   health --target production                          same, with SECRETS_ENV=prd
 *   health specs/auth/sign-in.feature                   one feature (repo-relative)
 *   health --tags '@domain:journeys'                    features narrowed by tags
 *   health --objectives                                 every live objective file
 *   health --objectives specs/runtime/availability.openslo.yaml   one objective
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { isProductionEnv } from '@libs/infra-shared/env-file';
import { envFile } from '@libs/infra-shared/envs';
import { exportSecretsMapLive } from '@libs/secrets-server/secrets-io';
import { stubFileName, stubSource } from '@pkgs/gherkin-shared/stubs';
import { isSyntheticFeatureSource } from '@pkgs/gherkin-shared/tags';
import { isLiveObjectiveSource } from '@pkgs/openslo-shared/live';
import { sloStubFileName, sloStubSource } from '@pkgs/openslo-shared/stubs';

const PACKAGE_DIR = resolve(import.meta.dir, '..');
const REPO_ROOT = resolve(PACKAGE_DIR, '../..');
const STEPS_ENTRY = join(PACKAGE_DIR, 'tests/steps/live-index.ts');
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
  /** `--synthetic`: `@synthetic` features only, not the critical journeys. */
  readonly synthetic: boolean;
  /** `--target`: `dev`/`test` or `prd`/`production`. Sets `SECRETS_ENV`. */
  readonly target: string | undefined;
  readonly bunArgs: readonly string[];
};

export function parseCli(argv: readonly string[]): Cli {
  const specPaths: string[] = [];
  const bunArgs: string[] = [];
  let tags: string | undefined;
  let objectives = false;
  let synthetic = false;
  let target: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--objectives') objectives = true;
    else if (arg === '--synthetic') synthetic = true;
    else if (arg === '--tags') tags = argv[++i];
    else if (arg.startsWith('--tags=')) tags = arg.slice('--tags='.length);
    else if (arg === '--target') target = argv[++i];
    else if (arg.startsWith('--target='))
      target = arg.slice('--target='.length);
    else if (arg.endsWith(FEATURE_SUFFIX) || arg.endsWith(SLO_SUFFIX))
      specPaths.push(arg);
    else bunArgs.push(arg);
  }
  return { specPaths, tags, objectives, synthetic, target, bunArgs };
}

/** `dev` and `prd` are the environments. `test` and `production` are aliases. */
export function targetEnv(target: string): string | null {
  if (target === 'dev' || target === 'test') return 'dev';
  if (target === 'prd' || target === 'production') return 'prd';
  return null;
}

function liveDomains(): readonly string[] {
  const manifest = JSON.parse(
    readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8')
  ) as { readonly liveDomains?: readonly string[] };
  return manifest.liveDomains ?? [];
}

function specsWhere(
  suffix: string,
  take: (text: string) => boolean
): readonly string[] {
  const root = join(REPO_ROOT, 'specs');
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((domain) => {
      const dir = join(root, domain.name);
      return readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
        .map((entry) => join(dir, entry.name))
        .filter((path) => take(readFileSync(path, 'utf8')));
    })
    .sort();
}

/** Journeys, every `@synthetic` feature, and every `# live` objective. */
export function allSpecs(): readonly string[] {
  const fromDomains = liveDomains().flatMap((domain) => {
    const dir = join(REPO_ROOT, 'specs', domain);
    if (!existsSync(dir)) return [];
    return [`*${FEATURE_SUFFIX}`, `*${SLO_SUFFIX}`]
      .flatMap((glob) => [...new Bun.Glob(glob).scanSync({ cwd: dir })])
      .map((file) => join(dir, file));
  });
  return [
    ...new Set([
      ...fromDomains,
      ...specsWhere(FEATURE_SUFFIX, isSyntheticFeatureSource),
      ...specsWhere(SLO_SUFFIX, isLiveObjectiveSource),
    ]),
  ].sort();
}

/** `--synthetic` keeps the tagged features and drops journeys and objectives. */
export function scopedSpecs(cli: Cli): readonly string[] {
  const all = allSpecs();
  if (!cli.synthetic) return all;
  return all.filter(
    (path) =>
      path.endsWith(FEATURE_SUFFIX) &&
      isSyntheticFeatureSource(readFileSync(path, 'utf8'))
  );
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
    feature: 'specs/billing/payments.feature',
    scenario: 'People can pay for Plus in production',
    needs: 'production',
    why: 'only production takes real payments',
  },
  {
    feature: 'specs/runtime/request-records.feature',
    needs: 'observability',
    why: 'with OBSERVABILITY_ENABLED=0 the environment keeps no request records',
  },
  {
    feature: 'specs/profile/finding-a-person.feature',
    needs: 'observability',
    why: 'with OBSERVABILITY_ENABLED=0 the environment keeps no trail of what happened to a person',
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

export function writeFeatureStubs(
  env: Environment,
  features: readonly string[],
  dirs: RunDirs,
  stepsEntry = STEPS_ENTRY
): readonly string[] {
  const { stubDir, reportDir } = dirs;
  const bridge = Bun.resolveSync(
    '@pkgs/gherkin-server/bun-test',
    import.meta.dir
  );
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
        stepsEntry,
        bridge,
        skip: skips.scenarios,
        reportDir,
        layer: 'release',
      })
    );
    return [`./${relative(PACKAGE_DIR, file)}`];
  });
}

export function writeSloStubs(
  objectives: readonly string[],
  dirs: RunDirs
): readonly string[] {
  if (objectives.length === 0) return [];
  if (!existsSync(SLO_ENTRY)) {
    console.error(
      `health: ${relative(PACKAGE_DIR, SLO_ENTRY)} is missing — liveDomains hold OpenSLO objectives, so an entry must import one tests/openslo/<stem>.binding.ts per objective file (each with spec: '<stem>')`
    );
    process.exit(1);
  }
  const { stubDir, reportDir } = dirs;
  const bridge = Bun.resolveSync(
    '@pkgs/openslo-server/bun-test',
    import.meta.dir
  );
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
  const selection = selectSpecs({ all: scopedSpecs(cli), cli });
  if (!selection.ok) {
    console.error(`health: ${selection.error} (${liveDomains().join(', ')})`);
    process.exit(1);
  }
  freshDirs(cli.objectives ? OBJECTIVE_DIRS : FEATURE_DIRS);
  return cli.objectives
    ? writeSloStubs(selection.specs, OBJECTIVE_DIRS)
    : writeFeatureStubs(offers, selection.specs, FEATURE_DIRS);
}

function applyTarget(target: string | undefined): void {
  if (target === undefined) return;
  const env = targetEnv(target);
  if (env === null) {
    console.error(
      `health: --target ${target} is not an environment (dev, test, prd, production)`
    );
    process.exit(1);
  }
  process.env['SECRETS_ENV'] = env;
}

export function healthTestArguments(
  cli: Cli,
  stubs: readonly string[]
): readonly string[] {
  return [
    'test',
    '--timeout',
    String(SCENARIO_TIMEOUT_MS),
    // Live journeys share one monitor account and Chrome storage. A second
    // scenario must not clear the first device or compete for its host slot.
    '--max-concurrency',
    '1',
    ...cli.bunArgs,
    ...stubs,
  ];
}

export function healthTestEnvironment(input: {
  readonly environment: string;
  readonly tags: string;
  readonly vars: NodeJS.ProcessEnv;
  readonly secrets: ReadonlyMap<string, string>;
}): NodeJS.ProcessEnv {
  return {
    ...input.vars,
    ...Object.fromEntries(input.secrets),
    SPEC_TAGS: input.tags,
    SPEC_WORLD: 'live',
    SECRETS_ENV: input.environment,
  };
}

if (import.meta.main) {
  const feature = process.env['HEALTH_SPEC']?.trim();
  const cli = parseCli([
    ...process.argv.slice(2),
    ...(feature ? [feature] : []),
  ]);
  if (cli.synthetic && cli.objectives) {
    console.error('health: --synthetic does not run objectives');
    process.exit(1);
  }
  applyTarget(cli.target);
  const { name, offers } = environmentOffers();
  const tags = cli.tags ?? '';
  const missing = (Object.keys(offers) as (keyof Environment)[]).filter(
    (need) => !offers[need]
  );
  const label = cli.synthetic ? 'synthetic' : 'health';
  console.log(
    `${label}${cli.objectives ? ' objectives' : ''}: ${name}${missing.length > 0 ? ` — without ${missing.join(', ')}` : ''}${tags.length > 0 ? ` — ${tags}` : ''}`
  );
  const stubs = writeStubs(cli, offers);
  if (stubs.length === 0) {
    console.error('health: nothing to run');
    process.exit(1);
  }
  const result = spawnSync('bun', healthTestArguments(cli, stubs), {
    cwd: PACKAGE_DIR,
    stdio: 'inherit',
    env: healthTestEnvironment({
      environment: name,
      tags,
      vars: process.env,
      secrets: await exportSecretsMapLive(name),
    }),
  });
  process.exit(result.status ?? 1);
}
