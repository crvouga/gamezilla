/**
 * The shape rules for a package's behavior tests, run by lint-package.ts
 * (docs/TESTING.md § 4 "Behavior tests are specs" and "One example app per
 * package"):
 *
 * - A test that acts as a person would and checks what they see is a
 *   scenario or a Quint model in `specs/<domain>/`, bound through the
 *   package's harness. `tests/harness/` holds only the harness composition
 *   (`support/`), so a `*.test.ts(x)` there is a behavior test that escaped
 *   the specs.
 * - A package tests itself through one kitchen-sink fixture app named
 *   `example-app`. Any other `example-*` directory is a second fixture app
 *   (a counter beside a clock beside a notes app); so is a second
 *   `example-app` directory. A test that needs a variation configures the
 *   one app instead of forking it.
 *
 * Pure over the package's tracked files, so it runs inside the package's
 * cached `lint`.
 */

const HARNESS_TEST = /(^|\/)tests\/harness\/(.+\/)?[^/]+\.test\.tsx?$/;
const FIXTURE_APP_DIR = /^example-/;
const EXAMPLE_APP = 'example-app';

/** Every directory (package-relative, no trailing slash) holding `files`. */
function directories(files: readonly string[]): readonly string[] {
  const out = new Set<string>();
  for (const file of files) {
    const parts = file.split('/');
    for (let depth = 1; depth < parts.length; depth++) {
      out.add(parts.slice(0, depth).join('/'));
    }
  }
  return [...out].sort();
}

function baseName(dir: string): string {
  return dir.slice(dir.lastIndexOf('/') + 1);
}

/**
 * Every rule a package whose tracked files (relative to the package root)
 * are `files` breaks. Empty when the package is clean.
 */
export function behaviorTestViolations(input: {
  readonly files: readonly string[];
}): readonly string[] {
  const files = input.files.filter((file) => !file.startsWith('node_modules/'));
  const out: string[] = [];
  const harnessTests = files.filter((file) => HARNESS_TEST.test(file));
  if (harnessTests.length > 0) {
    out.push(
      `test files under tests/harness/ — a behavior test is a scenario or Quint model in specs/<domain>/, bound through the harness; tests/harness/ holds only support/:\n    ${harnessTests.join('\n    ')}`
    );
  }
  const fixtureApps = directories(files).filter((dir) =>
    FIXTURE_APP_DIR.test(baseName(dir))
  );
  const forks = fixtureApps.filter((dir) => baseName(dir) !== EXAMPLE_APP);
  if (forks.length > 0) {
    out.push(
      `fixture apps other than example-app — grow the one kitchen-sink example-app instead of adding another:\n    ${forks.join('\n    ')}`
    );
  }
  const exampleApps = fixtureApps.filter(
    (dir) => baseName(dir) === EXAMPLE_APP
  );
  if (exampleApps.length > 1) {
    out.push(
      `more than one example-app — a package has exactly one fixture app:\n    ${exampleApps.join('\n    ')}`
    );
  }
  return out;
}
