#!/usr/bin/env bun
// @io-wall-ok — derives and writes each package's `src` task edges (`sync-src-edges`).
/**
 * Which workspace packages a package's `src` hash inherits.
 *
 * `src` is the hash every dependent's `lint`, `tc` and `test` inherit through
 * `^src`, and it is itself `dependsOn: ["^src"]`: a change walks up the whole
 * dependency graph. Turborepo draws that graph from every dependency a
 * `package.json` declares, so a package that only uses a helper in its tests
 * or scripts (`removeTree` in a teardown), or declares one it no longer
 * imports, passed the helper's every edit on to everything that depends on
 * it, though nothing outside the package can see the helper through `src`.
 *
 * What a dependent can see of a package is what its `exports` reach: `src/`,
 * and the few directories an `exports` entry names besides it. A package that
 * declares workspace packages those directories never name therefore lists
 * its `src` edges itself, in its `turbo.json`: the declared workspace packages
 * the visible files name. Its own `lint`, `tc` and `test` keep `^src` over
 * every declared dependency, so a helper's tests still rerun.
 *
 * `bun run libs/tools-harness-ts/scripts/src-task-edges.ts` rewrites the
 * `turbo.json` files; `src-task-edges.test.ts` fails when they drift.
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { isProductionSource } from './production-source';

export type SrcPackage = {
  readonly name: string;
  /** Repo-relative directory: `pkgs/clock-shared-ts`. */
  readonly dir: string;
  /** Every workspace-or-not dependency the manifest declares, in any section. */
  readonly declared: ReadonlySet<string>;
  /** Workspace packages named by a string in a non-test file a dependent can see. */
  readonly imported: ReadonlySet<string>;
};

/**
 * The `src` edges the package must declare, or undefined when every declared
 * workspace package is named by a visible file and the root `^src` is already
 * right. Workspace packages only; sorted.
 */
export function srcDependsOn(
  pkg: SrcPackage,
  workspace: ReadonlySet<string>
): readonly string[] | undefined {
  const declared = [...pkg.declared].filter((name) => workspace.has(name));
  const seen = declared.filter((name) => pkg.imported.has(name));
  if (seen.length === declared.length) return undefined;
  return seen.sort().map((name) => `${name}#src`);
}

export type TurboConfig = {
  $schema?: string;
  extends?: string[];
  tasks?: Record<string, { dependsOn?: string[]; [key: string]: unknown }>;
  [key: string]: unknown;
};

const SCHEMA = 'https://v2-11-3.turborepo.dev/schema.json';

/**
 * `config` with its `src` `dependsOn` set to `edges`, or removed when
 * `edges` is undefined. Undefined when nothing else is left in the file.
 */
export function withSrcDependsOn(
  config: TurboConfig | undefined,
  edges: readonly string[] | undefined
): TurboConfig | undefined {
  if (edges === undefined) {
    if (config?.tasks?.['src']?.dependsOn === undefined) return config;
    const { dependsOn: _removed, ...rest } = config.tasks['src'];
    const tasks = { ...config.tasks };
    if (Object.keys(rest).length === 0) delete tasks['src'];
    else tasks['src'] = rest;
    const next = { ...config, tasks };
    const kept = Object.keys(next).filter(
      (key) => key !== '$schema' && key !== 'extends' && key !== 'tasks'
    );
    return Object.keys(tasks).length === 0 && kept.length === 0
      ? undefined
      : next;
  }
  const base: TurboConfig = config ?? { $schema: SCHEMA, extends: ['//'] };
  const tasks = { ...base.tasks };
  tasks['src'] = { ...tasks['src'], dependsOn: [...edges] };
  return { ...base, tasks };
}

const ROOT = join(import.meta.dirname, '../../..');
const TIERS = ['apps', 'libs', 'pkgs'] as const;
const NAMED_WORKSPACE_PACKAGE =
  /['"](@(?:apps|libs|pkgs)\/[a-z0-9-]+)(?:\/[^'"]*)?['"]/g;

function sourcesUnder(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && isProductionSource(join(entry.parentPath, entry.name))
    )
    .map((entry) => join(entry.parentPath, entry.name));
}

function exportTargets(exports: unknown): string[] {
  if (typeof exports === 'string') return [exports];
  if (Array.isArray(exports)) return exports.flatMap(exportTargets);
  if (typeof exports === 'object' && exports !== null)
    return Object.values(exports).flatMap(exportTargets);
  return [];
}

/** `src/`, and each directory an `exports` entry reaches besides it. */
export function visibleDirectories(exports: unknown): string[] {
  const directories = new Set(['src']);
  for (const target of exportTargets(exports)) {
    const directory = /^\.\/([^/*]+)\//.exec(target)?.[1];
    // Generated directories (`.cache`) are not in a clean checkout.
    if (
      directory !== undefined &&
      !directory.startsWith('.') &&
      directory !== 'node_modules'
    )
      directories.add(directory);
  }
  return [...directories];
}

function importedBySource(dir: string, exports: unknown): Set<string> {
  const names = new Set<string>();
  for (const visible of visibleDirectories(exports))
    for (const file of sourcesUnder(join(ROOT, dir, visible)))
      for (const [, name] of readFileSync(file, 'utf8').matchAll(
        NAMED_WORKSPACE_PACKAGE
      ))
        names.add(name!);
  return names;
}

export function readWorkspace(root = ROOT): SrcPackage[] {
  const packages: SrcPackage[] = [];
  for (const tier of TIERS)
    for (const entry of readdirSync(join(root, tier)).sort()) {
      const file = join(root, tier, entry, 'package.json');
      if (!existsSync(file)) continue;
      const manifest = JSON.parse(readFileSync(file, 'utf8')) as {
        name: string;
        exports?: unknown;
        [section: string]: unknown;
      };
      const keys = (section: string): string[] =>
        Object.keys((manifest[section] as object | undefined) ?? {});
      packages.push({
        name: manifest.name,
        dir: `${tier}/${entry}`,
        declared: new Set(
          [
            'dependencies',
            'devDependencies',
            'optionalDependencies',
            'peerDependencies',
          ].flatMap(keys)
        ),
        imported: importedBySource(`${tier}/${entry}`, manifest.exports),
      });
    }
  return packages;
}

export type Drift = {
  readonly dir: string;
  readonly expected: readonly string[] | undefined;
  readonly actual: readonly string[] | undefined;
};

function turboConfigPath(dir: string): string {
  return join(ROOT, dir, 'turbo.json');
}

function readTurboConfig(dir: string): TurboConfig | undefined {
  const file = turboConfigPath(dir);
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as TurboConfig)
    : undefined;
}

/** Every package whose `turbo.json` does not hold the edges it should. */
export function srcEdgeDrift(
  packages: readonly SrcPackage[] = readWorkspace()
): Drift[] {
  const workspace = new Set(packages.map((pkg) => pkg.name));
  const drift: Drift[] = [];
  for (const pkg of packages) {
    const expected = srcDependsOn(pkg, workspace);
    const actual = readTurboConfig(pkg.dir)?.tasks?.['src']?.dependsOn;
    if (JSON.stringify(expected) !== JSON.stringify(actual))
      drift.push({ dir: pkg.dir, expected, actual });
  }
  return drift;
}

function writeEdges(dir: string, edges: readonly string[] | undefined): void {
  const next = withSrcDependsOn(readTurboConfig(dir), edges);
  const file = turboConfigPath(dir);
  if (next === undefined) rmSync(file, { force: true });
  else writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
}

/** Rewrite every `turbo.json` that has drifted; how many were written. */
export function syncSrcEdges(): number {
  const drift = srcEdgeDrift();
  for (const { dir, expected } of drift) writeEdges(dir, expected);
  return drift.length;
}

if (import.meta.main) {
  console.log(`src task edges: ${syncSrcEdges()} turbo.json files rewritten`);
}
