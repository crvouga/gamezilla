#!/usr/bin/env bun
// @io-wall-ok — CLI: one package's e2e suite (`test:e2e`), run from its root.
/**
 * Every package's `test:e2e` is this script, so every subsystem suite runs
 * under the same compile contract, preloads, timeout and reporting:
 *
 *   "test:e2e": "bun run ../../libs/sim-harness/scripts/test-e2e.ts"
 *
 * It wipes the package's report bucket (`.cache/sim-report`), turns every
 * feature of the domains the package's `specDomains` lists
 * (`specs/<domain>/*.feature` at the repo root) into a `bun test` stub under
 * `.cache/spec/`, runs
 * `bun test --parallel` over those stubs plus `tests/e2e` (or the paths
 * given) with a JUnit report written into the bucket, and exits with the
 * runner's status. With `SIM_REPORT=1` the sims also record frames there;
 * `bun run test:report` (root) folds every package's bucket into one HTML
 * report.
 *
 *   test:e2e                                   everything
 *   test:e2e specs/friends/friend-remove.feature   one feature (repo-relative)
 *   test:e2e -t 'ends the friendship'          scenarios by name
 *   test:e2e --tags '@goal:social:5'           scenarios by tag expression
 *   test:e2e tests/e2e/monkey.test.tsx         one code test
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
import { parseJunit } from '@pkgs/sim';
import { testFailureSpans } from '../src/observability/test-failure-spans';

const PACKAGE_DIR = process.cwd();
const REPORT_DIR = join(PACKAGE_DIR, '.cache/sim-report');
const SPEC_STUB_DIR = join(PACKAGE_DIR, '.cache/spec');
const JUNIT_PATH = join(REPORT_DIR, 'junit.xml');
const STEPS_ENTRY = join(PACKAGE_DIR, 'tests/steps/index.ts');
const REPO_ROOT = resolve(import.meta.dir, '../../..');
const SPECS_DIR = join(REPO_ROOT, 'specs');
const TEST_PACKAGE_NAME = process.env['npm_package_name'] ?? 'unknown';
const TEST_SERVICE_NAME = `${TEST_PACKAGE_NAME}-e2e`;
/** Per test. A live browser (`SIM_MODE=real|stack`) gets the time a person would. */
const TIMEOUT_MS = process.env['SIM_MODE'] === undefined ? 90_000 : 180_000;

type Cli = {
  readonly bunArgs: string[];
  readonly featurePaths: string[];
  readonly testPaths: string[];
  readonly tags: string | undefined;
};

/**
 * `--tags` is ours; everything else passes through to `bun test` in order
 * (`-t name`, `--timeout 1000` keep their values). The default scope (every
 * feature + `tests/e2e`) applies only when nothing names a feature or test
 * path, so a narrowed run never widens.
 */
function parseCli(argv: readonly string[]): Cli {
  const bunArgs: string[] = [];
  const featurePaths: string[] = [];
  const testPaths: string[] = [];
  let tags: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--tags') {
      tags = argv[++i];
    } else if (arg.startsWith('--tags=')) {
      tags = arg.slice('--tags='.length);
    } else if (arg.endsWith('.feature')) {
      featurePaths.push(arg);
    } else if (arg.startsWith('tests/') || /\.test\.[cm]?[jt]sx?$/.test(arg)) {
      testPaths.push(arg);
    } else {
      bunArgs.push(arg);
    }
  }
  return { bunArgs, featurePaths, testPaths, tags };
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

/** Absolute paths of every feature in this package's domains (flat). */
function listFeatures(): readonly string[] {
  return specDomains().flatMap((domain) => {
    const dir = join(SPECS_DIR, domain);
    if (!existsSync(dir)) return [];
    return [...new Bun.Glob('*.feature').scanSync({ cwd: dir })]
      .sort()
      .map((file) => join(dir, file));
  });
}

/** Absolute feature paths to run: the ones named, else all. */
function selectFeatures(cli: Cli): readonly string[] {
  const all = listFeatures();
  if (cli.featurePaths.length === 0) {
    return cli.testPaths.length === 0 ? all : [];
  }
  return cli.featurePaths.map((given) => {
    const candidates = [resolve(REPO_ROOT, given), resolve(PACKAGE_DIR, given)];
    const abs = candidates.find((path) => all.includes(path));
    if (abs === undefined) {
      console.error(
        `test-e2e: ${given} is not a feature of ${TEST_PACKAGE_NAME}'s specDomains (${specDomains().join(', ')})`
      );
      process.exit(1);
    }
    return abs;
  });
}

/** Write the stubs for `features` and return their `bun test` paths. */
function writeStubs(features: readonly string[]): readonly string[] {
  rmSync(SPEC_STUB_DIR, { recursive: true, force: true });
  if (features.length === 0) return [];
  if (!existsSync(STEPS_ENTRY)) {
    console.error(
      `test-e2e: ${relative(PACKAGE_DIR, STEPS_ENTRY)} is missing — a package with specDomains needs a steps entry that imports its step definitions and calls useSimWorld()`
    );
    process.exit(1);
  }
  mkdirSync(SPEC_STUB_DIR, { recursive: true });
  const bridge = Bun.resolveSync('@pkgs/gherkin/bun-test', import.meta.dir);
  const out: string[] = [];
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
        bridge,
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
const HARNESS_PRELOAD = Bun.resolveSync(
  '@libs/sim-harness/preload',
  import.meta.dir
);

const cli = parseCli(process.argv.slice(2));
const stubs = writeStubs(selectFeatures(cli));
const scope =
  cli.featurePaths.length === 0 && cli.testPaths.length === 0
    ? [...stubs, 'tests/e2e']
    : [...stubs, ...cli.testPaths];
if (scope.length === 0) {
  console.error('test-e2e: nothing to run');
  process.exit(1);
}

rmSync(REPORT_DIR, { recursive: true, force: true });
mkdirSync(REPORT_DIR, { recursive: true });

const result = spawnSync(
  'bun',
  [
    'test',
    '--conditions=browser',
    '--conditions=development',
    '--preload',
    SOLID_PRELOAD,
    '--preload',
    HARNESS_PRELOAD,
    ...(process.env['SIM_PRELOAD'] === undefined
      ? []
      : ['--preload', process.env['SIM_PRELOAD']]),
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
