/**
 * The rules a package's test scripts obey, run by lint-package.ts.
 *
 * `bun check` runs a package's `test`, `test:contract` and `test:spec` scripts
 * (the last as its `test:spec:<k>` parts, which spec-packages.ts holds to
 * exactly `test:spec` split; deploy's `check:api` runs `test:integration`). A green check is only
 * worth something if those scripts ran every test the package owns, every
 * time, the same way:
 *
 * - `--pass-with-no-tests` turns a broken path filter into a silent pass. A
 *   package with no tests has no `test` script instead.
 * - `--rerun-each` / `--retry` hide flakes behind a second chance. A flaky test
 *   is a bug to fix, not to retry.
 * - A test file no gate script reaches never runs. It reads like coverage and
 *   proves nothing.
 * - The harness spec runner also runs the specs (features and Quint models) of
 *   the domains the package lists in `specDomains`, so a `test:spec` with no
 *   `tests/harness/` file is fine when it runs specs; `spec:check` proves those
 *   domains exist.
 *
 * Pure over the manifest's scripts and the package's tracked files, so it
 * runs inside the package's cached `lint`.
 */

/** Scripts the gate runs. `test:integration` is deploy's live API probe. */
export const GATE_TEST_SCRIPTS = [
  'test',
  'test:contract',
  'test:spec',
  'test:integration',
] as const;

/** The one harness runner every package's `test:spec` uses. */
const SPEC_RUNNER = 'libs/harness/scripts/test-spec.ts';
const HARNESS_DIR = 'tests/harness/';

const BANNED_FLAGS: readonly { readonly flag: string; readonly why: string }[] =
  [
    {
      flag: '--pass-with-no-tests',
      why: 'a broken path filter would pass silently — drop the flag, and drop the script if the package has no tests',
    },
    {
      flag: '--rerun-each',
      why: 'reruns hide flakes — fix the flaky test',
    },
    {
      flag: '--retry',
      why: 'retries hide flakes — fix the flaky test',
    },
  ];

const TEST_FILE = /\.(test|spec)\.(ts|tsx)$/;

type ParsedBunTest = {
  readonly filters: readonly string[];
  readonly ignores: readonly string[];
};

/** Flags that take the next token as their value. */
const FLAGS_WITH_VALUE = new Set([
  '--preload',
  '--timeout',
  '--conditions',
  '--reporter',
  '--reporter-outfile',
  '--test-name-pattern',
  '-t',
]);

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, '');
}

function parseBunTest(script: string): ParsedBunTest | null {
  const tokens = script.trim().split(/\s+/);
  if (tokens[0] !== 'bun' || tokens[1] !== 'test') return null;
  const filters: string[] = [];
  const ignores: string[] = [];
  for (let i = 2; i < tokens.length; i++) {
    const token = tokens[i] ?? '';
    if (token.startsWith('--path-ignore-patterns=')) {
      ignores.push(unquote(token.slice('--path-ignore-patterns='.length)));
    } else if (FLAGS_WITH_VALUE.has(token)) {
      i++;
    } else if (!token.startsWith('-')) {
      filters.push(unquote(token).replace(/^\.\//, ''));
    }
  }
  return { filters, ignores };
}

function matchesFilter(file: string, filter: string): boolean {
  return filter.includes('*')
    ? new Bun.Glob(filter).match(file)
    : file.includes(filter);
}

/** Test files (package-relative) `script` runs, or null when unknowable. */
function filesRunBy(
  script: string,
  testFiles: readonly string[]
): readonly string[] | null {
  if (script.includes(SPEC_RUNNER)) {
    return testFiles.filter((file) => file.startsWith(HARNESS_DIR));
  }
  const parsed = parseBunTest(script);
  if (parsed === null) return null;
  return testFiles.filter(
    (file) =>
      !parsed.ignores.some((glob) => new Bun.Glob(glob).match(file)) &&
      (parsed.filters.length === 0 ||
        parsed.filters.some((filter) => matchesFilter(file, filter)))
  );
}

/**
 * Every rule `scripts` breaks for a package whose tracked files (relative to
 * the package root) are `files`. Empty when the package is clean.
 */
export function testScriptViolations(input: {
  readonly scripts: Readonly<Record<string, string>>;
  readonly files: readonly string[];
  /** The manifest's `specDomains`: specs the harness spec runner also runs. */
  readonly specDomains?: readonly string[];
}): readonly string[] {
  const out: string[] = [];
  const testFiles = input.files.filter(
    (file) => TEST_FILE.test(file) && !file.startsWith('node_modules/')
  );
  for (const [name, script] of Object.entries(input.scripts)) {
    if (!name.startsWith('test')) continue;
    for (const { flag, why } of BANNED_FLAGS) {
      if (script.includes(flag)) out.push(`"${name}" uses ${flag}: ${why}`);
    }
  }
  const reached = new Set<string>();
  for (const name of GATE_TEST_SCRIPTS) {
    const script = input.scripts[name];
    if (script === undefined) continue;
    const files = filesRunBy(script, testFiles);
    if (files === null) {
      out.push(
        `"${name}" is not \`bun test …\` or the harness spec runner, so which tests it runs cannot be checked`
      );
      continue;
    }
    const runsSpecs =
      script.includes(SPEC_RUNNER) && (input.specDomains ?? []).length > 0;
    if (files.length === 0 && !runsSpecs) {
      out.push(
        `"${name}" runs no test files — delete the script, or fix its path filter`
      );
    }
    for (const file of files) reached.add(file);
  }
  const orphans = testFiles.filter((file) => !reached.has(file));
  if (orphans.length > 0) {
    out.push(
      `test files no gate script runs (${GATE_TEST_SCRIPTS.join(', ')}) — they never execute:\n    ${orphans.join('\n    ')}`
    );
  }
  return out;
}
