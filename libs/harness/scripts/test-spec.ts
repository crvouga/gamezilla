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
 * run through `tests/steps/index.ts`), each Quint model
 * (`specs/<domain>/*.qnt`, its traces replayed through `tests/quint/index.ts`),
 * and each decision table, structure and objective (`*.dmn`, `*.als`,
 * `*.openslo.yaml`, checked through `tests/{dmn,alloy,openslo}/index.ts`;
 * see `spec-check-kinds.ts`) — runs `bun test --parallel` over those stubs plus `tests/harness` (or the
 * paths given) with a JUnit report written into the bucket, and exits with
 * the runner's status. Every harness writes its step timeline into the bucket and
 * every model its traces, and turbo caches the bucket with the verdict, so
 * `bun check` publishes the last run of this exact code; every step also
 * records its UI frames.
 *
 *   test:spec                                        everything
 *   test:spec specs/friends/friend-remove.feature    one feature (repo-relative)
 *   test:spec specs/spaces/space-hosting.qnt         one model
 *   test:spec specs/billing/access.dmn               one decision table
 *   test:spec -t 'ends the friendship'               scenarios by name
 *   test:spec --tags '@domain:friends'               scenarios by tag expression
 *   test:spec tests/harness/critical-journeys.test.tsx   one code test
 *   test:spec --part 2/5                             one of five parts
 *
 * `bun check` runs a suite in parts (`test:spec:<k>` = `--part k/n`, n the
 * package's `specParts`), so one package's suite spreads over several CI
 * shards instead of setting the whole run's wall time. {@link partOf} splits
 * by weight read from the specs alone, so every part — on any machine —
 * computes the same split. Each part owns its report bucket and stub dir
 * (`.cache/harness-report/part-<k>`, `.cache/spec/part-<k>`); an unsplit run
 * uses `all`.
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
import { isSyntheticFeatureSource } from '@pkgs/gherkin/tags';
import { isLiveObjectiveSource } from '@pkgs/openslo/live';
import { parseJunit } from '@pkgs/harness';
import { modelStubFileName, modelStubSource } from '@pkgs/quint/stubs';
import { testFailureSpans } from '../src/observability/test-failure-spans';
import { CHECK_KINDS, isSpecPath, SPEC_GLOBS } from './spec-check-kinds';
import { type Part, partOf, type SpecUnit, specUnits } from './spec-parts';

const PACKAGE_DIR = process.cwd();
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
  /** `--part k/n`: run the k-th (0-based) of n parts of the default scope. */
  readonly part: Part | undefined;
  /** Spec paths (`.feature`, `.qnt`, `.dmn`, `.als`, `.openslo.yaml`), as given. */
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
  let part: Part | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--part') {
      part = parsePart(argv[++i]);
    } else if (arg === '--tags') {
      tags = argv[++i];
    } else if (arg.startsWith('--tags=')) {
      tags = arg.slice('--tags='.length);
    } else if (isSpecPath(arg)) {
      specPaths.push(arg);
    } else if (arg.startsWith('tests/') || /\.test\.[cm]?[jt]sx?$/.test(arg)) {
      testPaths.push(arg);
    } else {
      bunArgs.push(arg);
    }
  }
  if (part !== undefined && (specPaths.length > 0 || testPaths.length > 0)) {
    console.error('test-spec: --part splits the whole suite; drop the paths');
    process.exit(1);
  }
  return { bunArgs, part, specPaths, testPaths, tags };
}

function parsePart(value: string | undefined): Part {
  const match = /^(\d+)\/(\d+)$/.exec(value ?? '');
  const index = Number(match?.[1]);
  const count = Number(match?.[2]);
  if (match === null || count < 1 || index >= count) {
    console.error(`test-spec: --part wants k/n with 0 <= k < n, got ${value}`);
    process.exit(1);
  }
  return { index, count };
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

/** Absolute paths of every spec in this package's domains (flat). */
function listSpecs(): readonly string[] {
  return specDomains().flatMap((domain) => {
    const dir = join(SPECS_DIR, domain);
    if (!existsSync(dir)) return [];
    // `events.qnt` is a context's published language (types only), not a model.
    return SPEC_GLOBS.flatMap((glob) => [
      ...new Bun.Glob(glob).scanSync({ cwd: dir }),
    ])
      .filter((file) => file !== 'events.qnt')
      .filter((file) => harnessKeeps(join(dir, file)))
      .sort()
      .map((file) => join(dir, file));
  });
}

/** `@synthetic` features and `# live` objectives run in `health`, not here. */
function harnessKeeps(path: string): boolean {
  if (path.endsWith('.feature')) {
    return !isSyntheticFeatureSource(readFileSync(path, 'utf8'));
  }
  if (path.endsWith('.openslo.yaml')) {
    return !isLiveObjectiveSource(readFileSync(path, 'utf8'));
  }
  return true;
}

/** The test files of `specs` (absolute paths), long specs sliced. */
function unitsOf(specs: readonly string[]): readonly SpecUnit[] {
  return specs.flatMap((path) => specUnits(path, readFileSync(path, 'utf8')));
}

/** Test files to run: the specs named, else all (or one part's share). */
function selectSpecs(cli: Cli): readonly SpecUnit[] {
  const all = listSpecs();
  if (cli.part !== undefined) return partOf(unitsOf(all), cli.part);
  if (cli.specPaths.length === 0) {
    return cli.testPaths.length === 0 ? unitsOf(all) : [];
  }
  return unitsOf(namedSpecs(cli, all));
}

function namedSpecs(cli: Cli, all: readonly string[]): readonly string[] {
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

/** Write the stubs for `units` and return their `bun test` paths. */
function writeStubs(units: readonly SpecUnit[]): readonly string[] {
  rmSync(SPEC_STUB_DIR, { recursive: true, force: true });
  if (units.length === 0) return [];
  mkdirSync(SPEC_STUB_DIR, { recursive: true });
  const features = units.filter((unit) => unit.path.endsWith('.feature'));
  const models = units.filter((unit) => unit.path.endsWith('.qnt'));
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
  const out: string[] = [...writeCheckStubs(units)];
  const gherkinBridge = Bun.resolveSync(
    '@pkgs/gherkin/bun-test',
    import.meta.dir
  );
  for (const { path: featurePath, slice } of features) {
    const featureUri = relative(REPO_ROOT, featurePath);
    const file = join(SPEC_STUB_DIR, stubFileName(featureUri, slice));
    writeFileSync(
      file,
      stubSource({
        packageName: TEST_PACKAGE_NAME,
        featurePath,
        featureUri,
        stepsEntry: STEPS_ENTRY,
        bridge: gherkinBridge,
        slice,
        reportDir: REPORT_DIR,
      })
    );
    out.push(`./${relative(PACKAGE_DIR, file)}`);
  }
  const quintBridge = Bun.resolveSync('@pkgs/quint/bun-test', import.meta.dir);
  for (const { path: specPath, slice } of models) {
    const specUri = relative(REPO_ROOT, specPath);
    const file = join(SPEC_STUB_DIR, modelStubFileName(specUri, slice));
    writeFileSync(
      file,
      modelStubSource({
        packageName: TEST_PACKAGE_NAME,
        specPath,
        specUri,
        quintEntry: QUINT_ENTRY,
        bridge: quintBridge,
        reportDir: REPORT_DIR,
        slice,
      })
    );
    out.push(`./${relative(PACKAGE_DIR, file)}`);
  }
  return out;
}

/** Stubs for the decision tables, structures and objectives among `units`. */
function writeCheckStubs(units: readonly SpecUnit[]): readonly string[] {
  return CHECK_KINDS.flatMap((kind) => {
    const specs = units.filter((unit) => unit.path.endsWith(kind.suffix));
    if (specs.length === 0) return [];
    const entry = join(PACKAGE_DIR, 'tests', kind.dir, 'index.ts');
    requireEntry(entry, kind.what);
    const bridge = Bun.resolveSync(kind.bridge, import.meta.dir);
    return specs.map(({ path: specPath }) => {
      const specUri = relative(REPO_ROOT, specPath);
      const file = join(SPEC_STUB_DIR, kind.fileName(specUri));
      writeFileSync(
        file,
        kind.source({
          packageName: TEST_PACKAGE_NAME,
          specPath,
          specUri,
          entry,
          bridge,
          reportDir: REPORT_DIR,
        })
      );
      return `./${relative(PACKAGE_DIR, file)}`;
    });
  });
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
const BUCKET = cli.part === undefined ? 'all' : `part-${cli.part.index}`;
const REPORT_DIR = join(PACKAGE_DIR, '.cache/harness-report', BUCKET);
const SPEC_STUB_DIR = join(PACKAGE_DIR, '.cache/spec', BUCKET);
const JUNIT_PATH = join(REPORT_DIR, 'junit.xml');
rmSync(REPORT_DIR, { recursive: true, force: true });
mkdirSync(REPORT_DIR, { recursive: true });

const stubs = writeStubs(selectSpecs(cli));
const withCodeTests =
  cli.specPaths.length === 0 &&
  cli.testPaths.length === 0 &&
  (cli.part?.index ?? 0) === 0 &&
  existsSync(join(PACKAGE_DIR, 'tests/harness'));
const scope = [
  ...stubs,
  ...(withCodeTests ? ['tests/harness'] : []),
  ...cli.testPaths,
];
if (scope.length === 0) {
  if (cli.part !== undefined) {
    // More parts than specs: this part has nothing, which is a pass.
    console.log(`test-spec: part ${BUCKET} of ${TEST_PACKAGE_NAME} is empty`);
    process.exit(0);
  }
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
    '--no-isolate',
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
      HARNESS_REPORT_DIR: REPORT_DIR,
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
