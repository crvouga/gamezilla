// @io-wall-ok — coverage reporter composition root
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const WORKSPACE_ROOTS = ['apps', 'libs', 'pkgs'] as const;

export type Tier = (typeof WORKSPACE_ROOTS)[number];

export type PackagePlan = {
  /** Package name from its manifest (`@pkgs/assert-root-shared`, `@libs/tools`). */
  readonly name: string;
  readonly tier: Tier;
  /** Absolute package directory (also the `bun test` cwd). */
  readonly dir: string;
  /** Absolute directory holding this package's per-command lcov output. */
  readonly coverageRoot: string;
  /** `bun test ...` script segments, run verbatim. */
  readonly commands: readonly string[];
};

type Manifest = {
  readonly name?: string;
  readonly scripts?: Readonly<Record<string, string>>;
};

const BUN_TEST_SEGMENT = /(?:^|\s)bun test(?:\s|$)/;

const SOURCE_EXCLUDED = [
  /\.d\.[cm]?ts$/,
  /\.test\.[cm]?tsx?$/,
  /\.spec\.[cm]?tsx?$/,
  /\.bench\.[cm]?tsx?$/,
];

const WALK_SKIP = new Set([
  'node_modules',
  'dist',
  '.turbo',
  '.cache',
  '__snapshots__',
]);

/** Split a package `test` script into its `&&` chain, dropping empties. */
export function splitScriptSegments(script: string): string[] {
  return script
    .split('&&')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '');
}

function readManifest(path: string): Manifest | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
  } catch {
    return undefined;
  }
}

function directoryEntries(path: string): string[] {
  try {
    return readdirSync(path).sort();
  } catch {
    return [];
  }
}

/** Every workspace package that declares a `test` script, sorted by tier/path. */
export function listPackagePlans(repoRoot: string): PackagePlan[] {
  const plans: PackagePlan[] = [];
  for (const tier of WORKSPACE_ROOTS) {
    const tierRoot = join(repoRoot, tier);
    for (const entry of directoryEntries(tierRoot)) {
      const dir = join(tierRoot, entry);
      if (!statSync(dir).isDirectory()) continue;
      const manifest = readManifest(join(dir, 'package.json'));
      const script = manifest?.scripts?.['test'];
      if (script === undefined) continue;
      plans.push({
        name: manifest?.name ?? `${tier}/${entry}`,
        tier,
        dir,
        coverageRoot: join(repoRoot, '.cache', 'coverage', `${tier}__${entry}`),
        commands: splitScriptSegments(script).filter((segment) =>
          BUN_TEST_SEGMENT.test(segment)
        ),
      });
    }
  }
  return plans;
}

/**
 * Absolute paths of a package's coverable sources: everything under `src`
 * that is not a test, spec, bench, or type declaration file.
 */
export function listSourceFiles(packageDir: string): string[] {
  const files: string[] = [];
  const pending = [join(packageDir, 'src')];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    for (const entry of directoryEntries(current)) {
      if (WALK_SKIP.has(entry)) continue;
      const path = join(current, entry);
      if (statSync(path).isDirectory()) {
        pending.push(path);
        continue;
      }
      if (!/\.[cm]?tsx?$/.test(entry)) continue;
      if (SOURCE_EXCLUDED.some((pattern) => pattern.test(entry))) continue;
      files.push(path);
    }
  }
  return files.sort();
}
