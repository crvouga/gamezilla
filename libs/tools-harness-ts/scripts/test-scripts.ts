/**
 * The rules a package's test scripts obey, run by lint-package.ts.
 *
 * `bun verify` runs a package's `test`, `test:contract`,
 * `test:contract:render` and `test:spec` scripts (the last as its
 * `test:spec:<k>` parts, which spec-packages.ts holds to exactly `test:spec`
 * split; release's `verify:api` runs `test:integration`). A green verification is only
 * worth something if those scripts ran every test the package owns, every
 * time, the same way:
 *
 * - `--pass-with-no-tests` turns a broken path filter into a silent pass. A
 *   package with no tests has no `test` script instead.
 * - `--rerun-each` / `--retry` hide flakes behind a second chance. A flaky test
 *   is a bug to fix, not to retry.
 * - A test file no gate script reaches never runs. It reads like coverage and
 *   proves nothing.
 * - `test:posix` is the one declared exception: tests of behavior only a POSIX
 *   host (Linux, macOS) has, such as process groups or a broker with no Windows
 *   build. CI runs only checks every runner OS can run, so no gate runs it;
 *   it is run by hand. Its files are disabled, not orphaned.
 * - The harness spec runner also runs the specs (features and Quint models) of
 *   the domains the package lists in `specDomains`, so a `test:spec` with no
 *   `tests/harness/` file is fine when it runs specs; `spec:verify` proves those
 *   domains exist.
 *
 * Pure over the manifest's scripts and the package's tracked files, so it
 * runs inside the package's cached `lint`.
 */

/**
 * Scripts the gate runs. `test:contract:render` is the browser half of a
 * package's contract, its own task so model proofs do not rerun the browser.
 * `test:integration` is release's live API probe.
 */
export const GATE_TEST_SCRIPTS = [
  'test',
  'test:contract',
  'test:contract:render',
  'test:spec',
  'test:integration',
] as const;

/**
 * Tests that only run on a POSIX host. Disabled: no gate runs them, because
 * every CI job must run on Linux, macOS and Windows alike.
 */
export const POSIX_TEST_SCRIPT = 'test:posix';

/** The one harness runner every package's `test:spec` uses. */
const SPEC_RUNNER = 'libs/harness-ts/scripts/test-spec.ts';
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

/**
 * Native test runners (`docs/POLYGLOT.md`): each runs every native test file
 * in its package's `tests/`, and fails itself when none ran.
 */
const NATIVE_RUNNERS = [
  'libs/tools-harness-ts/scripts/swift-task.ts test',
  'libs/tools-harness-ts/scripts/xcode-task.ts test',
] as const;
const NATIVE_TEST_FILE = /^tests\/.*\.swift$/;

type ParsedBunTest = {
  readonly filters: readonly string[];
  readonly ignores: readonly string[];
};

/** Flags that take the next token as their value. */
const FLAGS_WITH_VALUE = new Set([
  '--preload',
  '--tsconfig-override',
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
  let start = 0;
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[start] ?? '')) start += 1;
  if (tokens[start] !== 'bun' || tokens[start + 1] !== 'test') return null;
  const filters: string[] = [];
  const ignores: string[] = [];
  for (let i = start + 2; i < tokens.length; i++) {
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
  if (NATIVE_RUNNERS.some((runner) => script.endsWith(runner))) {
    return testFiles.filter((file) => NATIVE_TEST_FILE.test(file));
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
    (file) =>
      (TEST_FILE.test(file) || NATIVE_TEST_FILE.test(file)) &&
      !file.startsWith('node_modules/')
  );
  for (const [name, script] of Object.entries(input.scripts)) {
    if (
      /(?:^|\s)bun\s/.test(script) &&
      script.includes('@pkgs/bun-test-solid-client-ts/') &&
      !/--tsconfig-override(?:=|\s+)\.\.\/\.\.\/tsconfig\.json(?:\s|$)/.test(
        script
      )
    )
      out.push(
        `"${name}" loads Solid without the canonical compiler config — add --tsconfig-override ../../tsconfig.json so isolated runs resolve the same workspace modules`
      );
    if (!name.startsWith('test')) continue;
    for (const { flag, why } of BANNED_FLAGS) {
      if (script.includes(flag)) out.push(`"${name}" uses ${flag}: ${why}`);
    }
  }
  const reached = new Set<string>();
  const gateScripts = [
    ...GATE_TEST_SCRIPTS,
    ...Object.keys(input.scripts).filter((name) =>
      /^test:contract:\d+$/.test(name)
    ),
    POSIX_TEST_SCRIPT,
  ];
  for (const name of gateScripts) {
    const script = input.scripts[name];
    if (script === undefined) continue;
    const files = filesRunBy(script, testFiles);
    if (files === null) {
      out.push(
        `"${name}" is not \`bun test …\`, the harness spec runner or a native test runner, so which tests it runs cannot be verified`
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
      `test files no gate script runs (${[...GATE_TEST_SCRIPTS, POSIX_TEST_SCRIPT].join(', ')}) — they never execute:\n    ${orphans.join('\n    ')}`
    );
  }
  return out;
}
