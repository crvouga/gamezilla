#!/usr/bin/env bun
// @io-wall-ok — check CLI entry root (scripts/**).
/**
 * `check:patterns`: the independent pass over one package's own files.
 *
 * Run from a package directory. It parses that package and nothing else, so
 * the task runner caches it per package. `--json` prints the findings for
 * tooling; the verdict is the exit code either way.
 */
import { readCheckedPackage, readPackageFile } from '../src/package-files';
import { isPatternSource, patternViolations } from '../src/patterns';

const pkg = readCheckedPackage(process.cwd());
const violations = patternViolations(
  pkg.kind,
  pkg.files
    .filter(isPatternSource)
    .map((path) => ({ path, text: readPackageFile(pkg, path) }))
);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ package: pkg.dir, kind: pkg.kind, violations }));
} else {
  for (const v of violations)
    console.error(
      `${pkg.dir}/${v.path}:${v.line}:${v.column}: ${v.rule}: ${v.message}`
    );
  if (violations.length > 0)
    console.error(
      `${pkg.dir}: ${violations.length} forbidden pattern${violations.length === 1 ? '' : 's'} (${pkg.kind} package). Fix the code; nothing here can be suppressed.`
    );
}
process.exit(violations.length === 0 ? 0 : 1);
