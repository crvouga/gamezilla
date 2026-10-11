// @io-wall-ok — reads one package's own files for its cached checks.
/**
 * A package and the files that are its own, exactly as the task runner hashes
 * them: tracked plus untracked-but-not-ignored, under the package root.
 *
 * Every check script starts here, from its working directory, so a check
 * reads the package it runs in and nothing else.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { PackageKind } from './package-kind';
import { packageKind } from './package-kind';

export type PackageManifest = {
  readonly name?: string;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly exports?: unknown;
};

export type CheckedPackage = {
  /** Absolute repository root. */
  readonly root: string;
  /** Repository-relative package directory, e.g. `libs/auth-client`. */
  readonly dir: string;
  readonly kind: PackageKind;
  readonly manifest: PackageManifest;
  /** Package-relative paths of the package's own files. */
  readonly files: readonly string[];
};

/** The directory holding the workspace root manifest, searching up from `from`. */
export function findRepoRoot(from: string): string {
  let dir = resolve(from);
  for (;;) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest) && 'workspaces' in readJson(manifest)) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`no workspace root above ${from}`);
    dir = parent;
  }
}

function readJson(path: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new Error(`${path} is not a JSON object`);
  return { ...parsed };
}

function listFiles(root: string, dir: string): readonly string[] {
  const result = spawnSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', dir],
    { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  );
  if (result.status !== 0)
    throw new Error(`git ls-files failed for ${dir}: ${result.stderr}`);
  return result.stdout
    .split('\0')
    .filter((path) => path.length > 0 && existsSync(join(root, path)))
    .map((path) => path.slice(dir.length + 1));
}

/** The package whose directory is `cwd`. Throws anywhere else. */
export function readCheckedPackage(cwd: string): CheckedPackage {
  const root = findRepoRoot(cwd);
  const dir = relative(root, resolve(cwd)).split('\\').join('/');
  const kind = packageKind(dir);
  if (kind === undefined)
    throw new Error(
      `${dir === '' ? '(repository root)' : dir} is not a package under apps/, libs/ or pkgs/`
    );
  return {
    root,
    dir,
    kind,
    manifest: readJson(join(root, dir, 'package.json')),
    files: listFiles(root, dir),
  };
}

/** Text of one of the package's own files. */
export function readPackageFile(pkg: CheckedPackage, path: string): string {
  return readFileSync(join(pkg.root, pkg.dir, path), 'utf8');
}
