// @io-wall-ok — slice coverage CLI entry root (scripts/**).
/**
 * Every file in `tests/` must belong to exactly one `test:<slice>` script.
 *
 * CI runs the whole directory (`test` → `run-sim-tests.ts tests`), so a missing
 * file never stops being tested. The slices are the per-feature entry points a
 * person actually types — `bun run --filter @apps/product test:chess` — and
 * they are only worth typing while they are complete: a file in no slice is
 * invisible to the slice its feature owns, and a file in two runs twice.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PRODUCT_DIR = resolve(import.meta.dir, '..');
const TESTS_DIR = join(PRODUCT_DIR, 'tests');

/** Scripts that run sim suites — `test:fuzz` / `test:max` / `test:stack` do not. */
const RUNNER = 'run-sim-tests.ts';

type Manifest = { readonly scripts?: Readonly<Record<string, string>> };

/** `tests/foo-*.test.tsx` → a matcher over test file names. */
function globToRegExp(pattern: string): RegExp {
  const body = pattern
    .slice('tests/'.length)
    .replaceAll(/[.+^${}()|[\]\\]/g, String.raw`\$&`)
    .replaceAll('*', '[^/]*');
  return new RegExp(`^${body}$`);
}

function sliceMatchers(
  scripts: Readonly<Record<string, string>>
): ReadonlyMap<string, readonly RegExp[]> {
  const out = new Map<string, readonly RegExp[]>();
  for (const [name, command] of Object.entries(scripts)) {
    if (!name.startsWith('test:') || !command.includes(RUNNER)) continue;
    const patterns = command
      .split(/\s+/)
      .filter((token) => token.startsWith('tests/'))
      .map(globToRegExp);
    if (patterns.length > 0) out.set(name, patterns);
  }
  return out;
}

function testFiles(): readonly string[] {
  return readdirSync(TESTS_DIR)
    .filter((name) => name.endsWith('.test.ts') || name.endsWith('.test.tsx'))
    .sort();
}

function main(): void {
  const manifest = JSON.parse(
    readFileSync(join(PRODUCT_DIR, 'package.json'), 'utf8')
  ) as Manifest;
  const matchers = sliceMatchers(manifest.scripts ?? {});
  const problems: string[] = [];
  for (const file of testFiles()) {
    const owners = [...matchers]
      .filter(([, patterns]) => patterns.some((p) => p.test(file)))
      .map(([slice]) => slice);
    if (owners.length === 0) {
      problems.push(`tests/${file} belongs to no test:<slice> script`);
    } else if (owners.length > 1) {
      problems.push(`tests/${file} is claimed by ${owners.join(', ')}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      [
        'sim slice coverage is broken:',
        ...problems,
        'add the file to exactly one `test:<slice>` script in apps/product/package.json.',
      ].join('\n')
    );
  }
  console.log(
    `sim slices cover all ${String(testFiles().length)} test files (${String(matchers.size)} slices)`
  );
}

main();
