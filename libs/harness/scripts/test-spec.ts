#!/usr/bin/env bun
// @io-wall-ok — CLI: one package's spec suite (`test:spec`), run from its root.
/**
 * Every package's `test:spec` is this script, so every subsystem suite runs
 * under the same compile contract, preloads, timeout and reporting:
 *
 *   "test:spec": "bun run ../../libs/harness/scripts/test-spec.ts"
 *
 * It wipes the package's report bucket (`.cache/harness-report`), turns every
 * spec of the domains the package's `specDomains` lists into a `bun test`
 * stub under `.cache/spec/` — each Gherkin feature (`specs/<domain>/*.feature`,
 * run through `tests/steps/index.ts`) and each Quint model
 * (`specs/<domain>/*.qnt`, its traces replayed through `tests/quint/index.ts`)
 * — runs `bun test --parallel` over those stubs plus `tests/harness` (or the
 * paths given) with a JUnit report written into the bucket, and exits with
 * the runner's status. Every harness writes its step timeline into the bucket and
 * every model its traces, and turbo caches the bucket with the verdict, so
 * `bun run test:report` (root) renders the last run of this exact code;
 * `HARNESS_FRAMES=1` adds UI frames.
 *
 *   test:spec                                        everything
 *   test:spec specs/friends/friend-remove.feature    one feature (repo-relative)
 *   test:spec specs/spaces/space-hosting.qnt         one model
 *   test:spec -t 'ends the friendship'               scenarios by name
 *   test:spec --tags '@goal:social:5'                scenarios by tag expression
 *   test:spec tests/harness/critical-journeys.test.tsx   one code test
 */

import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { wallClock } from '@pkgs/clock';
import { stubFileName, stubSource } from '@pkgs/gherkin/stubs';
import { parseJunit } from '@pkgs/harness';
import { modelStubFileName, modelStubSource } from '@pkgs/quint/stubs';
import { testFailureSpans } from '../src/observability/test-failure-spans';

const PACKAGE_DIR = process.cwd();
const REPORT_DIR = join(PACKAGE_DIR, '.cache/harness-report');
const SPEC_STUB_DIR = join(PACKAGE_DIR, '.cache/spec');
const JUNIT_PATH = join(REPORT_DIR, 'junit.xml');
const STEPS_ENTRY = join(PACKAGE_DIR, 'tests/steps/index.ts');
const QUINT_ENTRY = join(PACKAGE_DIR, 'tests/quint/index.ts');
const REPO_ROOT = resolve(import.meta.dir, '../../..');
const SPECS_DIR = join(REPO_ROOT, 'specs');
const TEST_PACKAGE_NAME = process.env['npm_package_name'] ?? 'unknown';
const TEST_SERVICE_NAME = `${TEST_PACKAGE_NAME}-spec`;
/**
 * Per test, a wall clock. A scenario costs 2–5 s idle, but under a full
 * `bun check` (every package's spec plus the Quint models at once) chess
 * scenarios measured 60–95 s, past the old 90 s. 240 s is over twice that
 * loaded cost, so load cannot flip a verdict; the per-task budget still
 * bounds a hang. A live browser (`HARNESS_MODE=real|stack`) gets the same.
 */
const TIMEOUT_MS = 240_000;

type Cli = {
  readonly bunArgs: string[];
  /** `.feature` and `.qnt` paths, as given. */
  readonly specPaths: string[];
  readonly testPaths: string[];
  readonly tags: string | undefined;
};

/**
 * `--tags` is ours; everything else passes through to `bun test` in order
 * (`-t name`, `--timeout 1000` keep their values). The default scope (every
 * spec + `tests/harness`) applies only when nothing names a spec or test path, so
 * a narrowed run never widens.
 */
function parseCli(argv: readonly string[]): Cli {
  const bunArgs: string[] = [];
  const specPaths: string[] = [];
  const testPaths: string[] = [];
  let tags: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--tags') {
      tags = argv[++i];
    } else if (arg.startsWith('--tags=')) {
      tags = arg.slice('--tags='.length);
    } else if (arg.endsWith('.feature') || arg.endsWith('.qnt')) {
      specPaths.push(arg);
    } else if (arg.startsWith('tests/') || /\.test\.[cm]?[jt]sx?$/.test(arg)) {
      testPaths.push(arg);
    } else {
      bunArgs.push(arg);
    }
  }
  return { bunArgs, specPaths, testPaths, tags };
}

/** The `specs/<domain>/` directories this package runs (`specDomains`). */
function specDomains(): readonly string[] {
  const manifestPath = join(PACKAGE_DIR, 'package.json');
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    readonly specDomains?: readonly string[];
  };
  return manifest.specDomains ?? [];
}

/** Absolute paths of every spec (`.feature`, `.qnt`) in this package's domains (flat). */
function listSpecs(): readonly string[] {
  return specDomains().flatMap((domain) => {
    const dir = join(SPECS_DIR, domain);
    if (!existsSync(dir)) return [];
    // `events.qnt` is a context's published language (types only), not a model.
    return [...new Bun.Glob('*.{feature,qnt}').scanSync({ cwd: dir })]
      .filter((file) => file !== 'events.qnt')
      .sort()
      .map((file) => join(dir, file));
  });
}

/** Absolute spec paths to run: the ones named, else all. */
function selectSpecs(cli: Cli): readonly string[] {
  const all = listSpecs();
  if (cli.specPaths.length === 0) {
    return cli.testPaths.length === 0 ? all : [];
  }
  return cli.specPaths.map((given) => {
    const candidates = [resolve(REPO_ROOT, given), resolve(PACKAGE_DIR, given)];
    const abs = candidates.find((path) => all.includes(path));
    if (abs === undefined) {
      console.error(
        `test-spec: ${given} is not a spec of ${TEST_PACKAGE_NAME}'s specDomains (${specDomains().join(', ')})`
      );
      process.exit(1);
    }
    return abs;
  });
}

function requireEntry(entry: string, what: string): void {
  if (existsSync(entry)) return;
  console.error(
    `test-spec: ${relative(PACKAGE_DIR, entry)} is missing — a package whose specDomains hold ${what}`
  );
  process.exit(1);
}

/** Write the stubs for `specs` and return their `bun test` paths. */
function writeStubs(specs: readonly string[]): readonly string[] {
  rmSync(SPEC_STUB_DIR, { recursive: true, force: true });
  if (specs.length === 0) return [];
  mkdirSync(SPEC_STUB_DIR, { recursive: true });
  const features = specs.filter((path) => path.endsWith('.feature'));
  const models = specs.filter((path) => path.endsWith('.qnt'));
  if (features.length > 0) {
    requireEntry(
      STEPS_ENTRY,
      'features needs a steps entry that imports its step definitions and calls useHarnessWorld()'
    );
  }
  if (models.length > 0) {
    requireEntry(
      QUINT_ENTRY,
      'Quint models needs a quint entry that imports its model bindings and calls useQuintHarness()'
    );
  }
  const out: string[] = [];
  const gherkinBridge = Bun.resolveSync(
    '@pkgs/gherkin/bun-test',
    import.meta.dir
  );
  for (const featurePath of features) {
    const featureUri = relative(REPO_ROOT, featurePath);
    const file = join(SPEC_STUB_DIR, stubFileName(featureUri));
    writeFileSync(
      file,
      stubSource({
        packageName: TEST_PACKAGE_NAME,
        featurePath,
        featureUri,
        stepsEntry: STEPS_ENTRY,
        bridge: gherkinBridge,
      })
    );
    out.push(`./${relative(PACKAGE_DIR, file)}`);
  }
  const quintBridge = Bun.resolveSync('@pkgs/quint/bun-test', import.meta.dir);
  for (const specPath of models) {
    const specUri = relative(REPO_ROOT, specPath);
    const file = join(SPEC_STUB_DIR, modelStubFileName(specUri));
    writeFileSync(
      file,
      modelStubSource({
        packageName: TEST_PACKAGE_NAME,
        specPath,
        specUri,
        quintEntry: QUINT_ENTRY,
        bridge: quintBridge,
        reportDir: REPORT_DIR,
      })
    );
    out.push(`./${relative(PACKAGE_DIR, file)}`);
  }
  return out;
}

/**
 * The preloads belong to this package (it declares them), not to whichever
 * package is running its suite — resolve them here, so a suite runs under an
 * isolated install without every feature re-declaring the harness's deps.
 */
const SOLID_PRELOAD = Bun.resolveSync(
  '@pkgs/bun-test-solid/preload',
  import.meta.dir
);
const BASE_PRELOAD = Bun.resolveSync('@libs/harness/preload', import.meta.dir);

const cli = parseCli(process.argv.slice(2));
rmSync(REPORT_DIR, { recursive: true, force: true });
mkdirSync(REPORT_DIR, { recursive: true });

const stubs = writeStubs(selectSpecs(cli));
const scope =
  cli.specPaths.length === 0 && cli.testPaths.length === 0
    ? [...stubs, 'tests/harness']
    : [...stubs, ...cli.testPaths];
if (scope.length === 0) {
  console.error('test-spec: nothing to run');
  process.exit(1);
}

const result = spawnSync(
  'bun',
  [
    'test',
    '--conditions=browser',
    '--conditions=development',
    '--preload',
    SOLID_PRELOAD,
    '--preload',
    BASE_PRELOAD,
    ...(process.env['HARNESS_PRELOAD'] === undefined
      ? []
      : ['--preload', process.env['HARNESS_PRELOAD']]),
    '--timeout',
    String(TIMEOUT_MS),
    '--parallel',
    '--reporter=junit',
    `--reporter-outfile=${JUNIT_PATH}`,
    ...cli.bunArgs,
    ...scope,
  ],
  {
    cwd: PACKAGE_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(cli.tags === undefined ? {} : { SPEC_TAGS: cli.tags }),
      OBS_TRACE_ARTIFACT_DIR: join(REPORT_DIR, 'traces'),
      OBS_TEST_SERVICE: TEST_SERVICE_NAME,
    },
  }
);

appendFailureTraces();

process.exit(result.status ?? 1);

function appendFailureTraces(): void {
  if (!existsSync(JUNIT_PATH)) return;
  const traceDir = join(REPORT_DIR, 'traces');
  const spans = testFailureSpans(parseJunit(readFileSync(JUNIT_PATH, 'utf8')), {
    buildSha: process.env['GITHUB_SHA'] ?? 'local',
    ...(process.env['GITHUB_RUN_ID'] === undefined
      ? {}
      : { ciRunId: process.env['GITHUB_RUN_ID'] }),
    completedAtMs: wallClock.now(),
    environment: process.env['GITHUB_ACTIONS'] === 'true' ? 'ci' : 'test',
    packageName: TEST_PACKAGE_NAME,
    serviceName: TEST_SERVICE_NAME,
  });
  if (spans.length === 0) return;
  mkdirSync(traceDir, { recursive: true });
  appendFileSync(
    join(traceDir, 'spans.ndjson'),
    `${spans.map((span) => JSON.stringify(span)).join('\n')}\n`,
    'utf8'
  );
}
