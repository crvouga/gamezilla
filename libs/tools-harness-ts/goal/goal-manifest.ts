/**
 * Known-bug gate (`@libs/tools-harness-ts#ci:goals`).
 *
 * Every bug that was found stays guarded by an example regression test: the
 * concrete input that broke, pinned forever. Properties and models explore;
 * they are not guards, because a pinned seed that happens to reach the bug
 * today may not after the generator changes. What the app should be lives in
 * `specs/` and is not a checklist in this module.
 */

import { playwrightRegressionProof } from './playwright-regression-proof';
import { quintRegressionProof } from './quint-regression-proof';

/**
 * A bug that was found and fixed. Its guard is always an example-based
 * regression test.
 */
export type KnownBug = {
  readonly id: string;
  readonly summary: string;
  /**
   * Repo-relative test file carrying `regression: <id>` beside the test, or
   * a `.feature` whose pinned scenario is tagged `@regression:<id>`, or a
   * canonical Quint binding registering a marked literal ITF history.
   * Playwright adapters may use `.checks.ts` to avoid Bun test discovery;
   * those files must import the runner and register a marked literal test.
   */
  readonly regressionTest: string;
};

/**
 * Which proof files one pass reads. The gate makes one pass for the paths
 * outside the package tiers and one per package, so a proof and the history
 * it pins are held to the package that owns them.
 */
export type ProofFiles = {
  readonly owns: (path: string) => boolean;
  /** Reads a repo-relative path; `null` when the file is missing. */
  readonly read: (path: string) => string | null;
};

export function regressionMarker(bugId: string): string {
  return `regression: ${bugId}`;
}

/** The scenario tag that pins a known bug in a `.feature` file. */
export function regressionTag(bugId: string): string {
  return `@regression:${bugId}`;
}

const TEST_FILE = /\.test\.tsx?$/;
const PLAYWRIGHT_FILE = /\.checks\.ts$/;
const PROPERTY_FILE = /\.property\.(?:test\.tsx?|checks\.ts)$/;
const FEATURE_FILE = /\.feature$/;
const QUINT_BINDING = /(?:^|\/)tests\/quint\/[^/]+\.binding\.ts$/;

function validateRegressionTest(
  bug: KnownBug,
  files: ProofFiles,
  errors: string[]
): void {
  const label = `known-bugs:${bug.id}`;
  const path = bug.regressionTest;
  const feature = typeof path === 'string' && FEATURE_FILE.test(path);
  const quint = typeof path === 'string' && QUINT_BINDING.test(path);
  const playwright = typeof path === 'string' && PLAYWRIGHT_FILE.test(path);
  if (
    typeof path !== 'string' ||
    !(feature || quint || playwright || TEST_FILE.test(path))
  ) {
    errors.push(
      `${label}: regressionTest must be a *.test.ts(x) or *.feature file, a marked Playwright *.checks.ts test, or a pinned tests/quint/*.binding.ts registration`
    );
    return;
  }
  if (PROPERTY_FILE.test(path)) {
    errors.push(
      `${label}: ${path} is a property test — a regression guard is an example test that pins the input that broke`
    );
    return;
  }
  if (!files.owns(path)) return;
  const body = files.read(path);
  if (body === null) {
    errors.push(`${label}: regression test not found: ${path}`);
    return;
  }
  const marker = feature ? regressionTag(bug.id) : regressionMarker(bug.id);
  if (!body.includes(marker)) {
    errors.push(`${label}: ${path} does not contain marker "${marker}"`);
  }
  if (playwright) {
    const failure = playwrightRegressionProof(body, marker);
    if (failure !== null) errors.push(`${label}: ${path} ${failure}`);
  }
  if (quint) {
    const failure = quintRegressionProof({ body, bugId: bug.id, path, files });
    if (failure !== null) errors.push(`${label}: ${path} ${failure}`);
  }
}

function validateKnownBugs(
  bugs: readonly KnownBug[],
  files: ProofFiles,
  errors: string[]
): void {
  for (const bug of bugs) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(bug.id)) {
      errors.push(
        `known-bugs: file name "${bug.id}.json" must be lower-kebab-case`
      );
    }
    if (bug.summary.trim().length === 0) {
      errors.push(`known-bugs: entry "${bug.id}" needs a summary`);
    }
    validateRegressionTest(bug, files, errors);
  }
}

export function validateGoalGate(input: {
  readonly knownBugs: readonly KnownBug[];
  readonly proofFiles: ProofFiles;
}): readonly string[] {
  const errors: string[] = [];
  validateKnownBugs(input.knownBugs, input.proofFiles, errors);
  return errors;
}

/**
 * Missing or unmarked regression files among those `files` owns — the gate's
 * pass over one package, for the bugs whose tests live in it.
 */
function validateProofFiles(input: {
  readonly knownBugs: readonly KnownBug[];
  readonly files: ProofFiles;
}): readonly string[] {
  const errors: string[] = [];
  for (const bug of input.knownBugs) {
    validateRegressionTest(bug, input.files, errors);
  }
  return errors;
}

const PACKAGE = /^(?:apps|libs|pkgs)\/[^/]+(?=\/)/;

/**
 * The whole register: the bookkeeping and the proofs outside the package
 * tiers, then every package a proof names — whether or not that package
 * still exists, so a proof left behind by a rename is reported as missing.
 */
export function validateRegister(input: {
  readonly knownBugs: readonly KnownBug[];
  readonly read: ProofFiles['read'];
}): readonly string[] {
  const { knownBugs, read } = input;
  const packages = [
    ...new Set(
      knownBugs.flatMap((bug) => PACKAGE.exec(bug.regressionTest)?.[0] ?? [])
    ),
  ].sort();
  return [
    ...validateGoalGate({
      knownBugs,
      proofFiles: { owns: (path) => !PACKAGE.test(path), read },
    }),
    ...packages.flatMap((pkg) =>
      validateProofFiles({
        knownBugs,
        files: { owns: (path) => path.startsWith(`${pkg}/`), read },
      })
    ),
  ];
}
