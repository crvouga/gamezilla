#!/usr/bin/env bun
// @io-wall-ok — lint CLI entry root (scripts/**).
/**
 * Lint one package: path naming, Biome (which also carries the import-boundary
 * rules), the Solid oxlint scope, the package-boundary rules and the goal
 * proofs that live in it, over that package's files and nothing else. The
 * external tools run concurrently: a package's lint costs its slowest tool,
 * not the sum.
 *
 * Every package's `lint` script runs this from its own directory, so turbo
 * caches lint per package and a PR re-lints only what it touched (plus its
 * dependents, since type-aware rules read upstream types — `lint` depends on
 * `tc` in turbo.json). Each tool runs from the repo root so it resolves the
 * one root config exactly as a whole-repo run would.
 *
 * Run from the repo root itself (`//#lint:root`) it covers the paths that
 * belong to no package: root config files, editor and agent settings.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { GoalChecks, KnownBug } from '../goal/goal-manifest';
import { validateProofFiles } from '../goal/goal-manifest';
import { findNamingViolations } from '../naming/naming-rules';
import { macrosOutsideCatalog } from './lingui-scope';
import { packageBoundaryViolations } from './package-boundaries';
import { unusedWorkspaceDependencies } from './unused-dependencies';

const REPO_ROOT = resolve(import.meta.dir, '../../..');
const PACKAGE_TIER = /^(apps|libs|pkgs)\//;

type SolidScope = {
  readonly dirs: readonly string[];
  readonly files: readonly string[];
  readonly reactivityDirs?: readonly string[];
  readonly noDestructureDirs?: readonly string[];
};

/** Tracked and untracked-but-not-ignored paths, as turbo hashes them. */
function listFiles(pathspec: readonly string[]): readonly string[] | null {
  const result = spawnSync(
    'git',
    [
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
      ...pathspec,
    ],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.status !== 0) return null;
  // `--cached` still lists a tracked file deleted in the working tree.
  return result.stdout
    .split('\0')
    .filter((path) => path.length > 0 && existsSync(join(REPO_ROOT, path)));
}

/** `lint:naming` over just these paths; `bun run naming:fix` repairs them. */
function namingOk(paths: readonly string[]): boolean {
  const violations = findNamingViolations([...paths]);
  for (const v of violations) {
    console.error(
      `naming: ${v.kind} ${v.path} → ${v.suggested} (Markdown docs SCREAMING_SNAKE_CASE.md, everything else lower-kebab-case; fix with \`bun run naming:fix\`)`
    );
  }
  return violations.length === 0;
}

function run(tool: string, args: readonly string[]): Promise<boolean> {
  return new Promise((resolveRun) => {
    const child = spawn('bunx', [tool, ...args], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    child.on('error', () => resolveRun(false));
    child.on('close', (code) => resolveRun(code === 0));
  });
}

/**
 * Paths in the Solid scope that live inside `pkg`. `oxlint.config.mts` reads
 * the same file to pick each path's rules.
 */
function solidTargets(pkg: string): readonly string[] {
  const scope = JSON.parse(
    readFileSync(join(REPO_ROOT, 'libs/tools/port/solid-scope.json'), 'utf8')
  ) as SolidScope;
  return [
    ...scope.dirs,
    ...scope.files,
    ...(scope.reactivityDirs ?? []),
    ...(scope.noDestructureDirs ?? []),
  ].filter((path) => path.startsWith(`${pkg}/`));
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8')) as T;
}

/** Goal proofs (`docs/GOAL.md`) that point into `pkg` still hold. */
function goalProofsOk(pkg: string): boolean {
  const errors = validateProofFiles({
    checks: readJson<GoalChecks>('libs/tools/goal/goal-checks.json'),
    knownBugs: readJson<readonly KnownBug[]>('libs/tools/goal/known-bugs.json'),
    files: {
      owns: (path) => path.startsWith(`${pkg}/`),
      read: (path) => {
        try {
          return readFileSync(join(REPO_ROOT, path), 'utf8');
        } catch {
          return null;
        }
      },
    },
  });
  for (const error of errors) console.error(`goal: ${error}`);
  return errors.length === 0;
}

async function lintPackage(pkg: string): Promise<boolean> {
  const files = listFiles(['--', pkg]);
  const tools = [run('biome', ['check', '--error-on-warnings', pkg])];
  const solid = solidTargets(pkg);
  if (solid.length > 0) {
    // Type-aware rules run through oxlint-tsgolint (`options.typeAware`).
    tools.push(run('oxlint', ['--deny-warnings', ...solid]));
  }
  let ok = files !== null && namingOk(files);
  ok = goalProofsOk(pkg) && ok;
  const untranslated = macrosOutsideCatalog(
    (files ?? [])
      .filter((path) => /\.tsx?$/.test(path))
      .map((path) => ({
        path,
        text: readFileSync(join(REPO_ROOT, path), 'utf8'),
      }))
  );
  if (untranslated.length > 0) {
    console.error(
      `${pkg}: Lingui macros outside the catalog sources render hashed ids in production — add the package's src dir to libs/tools/scripts/lingui-scope.ts:\n  ${untranslated.join('\n  ')}`
    );
    ok = false;
  }
  const unused =
    files === null
      ? []
      : unusedWorkspaceDependencies(
          join(REPO_ROOT, pkg),
          files.map((path) => path.slice(pkg.length + 1))
        );
  if (unused.length > 0) {
    console.error(
      `${pkg}: declares workspace dependencies nothing in it uses — each reruns this package's checks on every change to it; remove them:\n  ${unused.join('\n  ')}`
    );
    ok = false;
  }
  const boundaries = packageBoundaryViolations(join(REPO_ROOT, pkg));
  if (boundaries.length > 0) {
    console.error(
      `${pkg}: package boundaries violated — turbo builds its graph from package.json, so this is a cache invalidation everywhere downstream:\n  ${boundaries.join('\n  ')}`
    );
    ok = false;
  }
  return (await Promise.all(tools)).every(Boolean) && ok;
}

/** Paths outside apps/ libs/ pkgs/ — root config, editor and agent settings. */
function lintRoot(): Promise<boolean> {
  const all = listFiles([]);
  if (all === null) return Promise.resolve(false);
  const files = all.filter((path) => !PACKAGE_TIER.test(path));
  const ok = namingOk(files);
  return run('biome', [
    'check',
    '--error-on-warnings',
    '--files-ignore-unknown=true',
    '--no-errors-on-unmatched',
    ...files,
  ]).then((biomeOk) => biomeOk && ok);
}

const pkg = relative(REPO_ROOT, process.cwd());
const ok = await (pkg === '' ? lintRoot() : lintPackage(pkg));
process.exit(ok ? 0 : 1);
