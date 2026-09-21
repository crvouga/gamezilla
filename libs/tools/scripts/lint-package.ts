#!/usr/bin/env bun
// @io-wall-ok — lint CLI entry root (scripts/**).
/**
 * Lint one package: path naming, Biome, the Solid ESLint scope, depcruise, the
 * package-boundary rules and the goal proofs that live in it, over that
 * package's files and nothing else.
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
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { GoalChecks, KnownBug } from '../goal/goal-manifest';
import { validateProofFiles } from '../goal/goal-manifest';
import { findNamingViolations } from '../naming/naming-rules';
import { packageBoundaryViolations } from './package-boundaries';

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
  return result.stdout.split('\0').filter((path) => path.length > 0);
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

function run(
  tool: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const result = spawnSync('bunx', [tool, ...args], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env,
  });
  return result.status === 0;
}

/** Paths in the ESLint Solid scope that live inside `pkg`. */
function eslintTargets(pkg: string): readonly string[] {
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

function lintPackage(pkg: string): boolean {
  const files = listFiles(['--', pkg]);
  let ok = files !== null && namingOk(files);
  ok = goalProofsOk(pkg) && ok;
  ok = run('biome', ['check', '--error-on-warnings', pkg]) && ok;
  const solid = eslintTargets(pkg);
  if (solid.length > 0) {
    // Type-aware rules build a program from the package's own tsconfig (the
    // one `tc` checks) instead of the whole-repo root project: 2s, not 17s.
    const tsconfig = existsSync(join(REPO_ROOT, pkg, 'tsconfig.tc.json'))
      ? 'tsconfig.tc.json'
      : 'tsconfig.json';
    ok =
      run('eslint', ['--max-warnings', '0', ...solid], {
        ...process.env,
        ESLINT_PACKAGE_TSCONFIG: `./${pkg}/${tsconfig}`,
      }) && ok;
  }
  ok =
    run('dependency-cruise', [
      pkg,
      '--validate',
      '.dependency-cruiser.cjs',
      '--output-type',
      'err',
    ]) && ok;
  const boundaries = packageBoundaryViolations(join(REPO_ROOT, pkg));
  if (boundaries.length > 0) {
    console.error(
      `${pkg}: package boundaries violated — turbo builds its graph from package.json, so this is a cache invalidation everywhere downstream:\n  ${boundaries.join('\n  ')}`
    );
    ok = false;
  }
  return ok;
}

/** Paths outside apps/ libs/ pkgs/ — root config, editor and agent settings. */
function lintRoot(): boolean {
  const all = listFiles([]);
  if (all === null) return false;
  const files = all.filter((path) => !PACKAGE_TIER.test(path));
  const ok = namingOk(files);
  return (
    run('biome', [
      'check',
      '--error-on-warnings',
      '--files-ignore-unknown=true',
      '--no-errors-on-unmatched',
      ...files,
    ]) && ok
  );
}

const pkg = relative(REPO_ROOT, process.cwd());
const ok = pkg === '' ? lintRoot() : lintPackage(pkg);
process.exit(ok ? 0 : 1);
