/**
 * Rename plan for the naming codemod — pure, no I/O.
 *
 * Every file whose path (any segment) breaks the convention maps to its
 * converted path; renamed directories therefore expand to one entry per file
 * beneath them. `dirs` carries the directory-level view for references that
 * name a directory rather than a file.
 */
import { convertPath } from './naming-rules';

export interface RenamePlan {
  /** Old file path → new file path (only paths that change). */
  readonly files: ReadonlyMap<string, string>;
  /** Old directory path → new directory path (only directories that change). */
  readonly dirs: ReadonlyMap<string, string>;
  /** Human-readable collision descriptions; the plan must not be applied if non-empty. */
  readonly collisions: readonly string[];
}

function inScope(path: string, prefixes: readonly string[]): boolean {
  return (
    prefixes.length === 0 ||
    prefixes.some(
      (p) => path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`)
    )
  );
}

function addDirRenames(
  oldPath: string,
  newPath: string,
  dirs: Map<string, string>
): void {
  const oldSegs = oldPath.split('/');
  const newSegs = newPath.split('/');
  for (let i = 1; i < oldSegs.length; i += 1) {
    const oldDir = oldSegs.slice(0, i).join('/');
    const newDir = newSegs.slice(0, i).join('/');
    if (oldDir !== newDir) dirs.set(oldDir, newDir);
  }
}

function findCollisions(
  all: readonly string[],
  files: ReadonlyMap<string, string>
): string[] {
  const collisions: string[] = [];
  const targets = new Map<string, string>();
  for (const [from, to] of files) {
    const key = to.toLowerCase();
    const prior = targets.get(key);
    if (prior !== undefined) {
      collisions.push(`${prior} and ${from} both become ${to}`);
    }
    targets.set(key, from);
  }
  for (const path of all) {
    if (files.has(path)) continue;
    const clash = targets.get(path.toLowerCase());
    if (clash !== undefined) {
      collisions.push(
        `${clash} → ${files.get(clash)} clashes with existing ${path}`
      );
    }
  }
  return collisions;
}

/**
 * @param paths every repo-relative file path (tracked + untracked, not ignored)
 * @param prefixes limit renames to these path prefixes (empty = whole repo)
 */
export function planRenames(
  paths: readonly string[],
  prefixes: readonly string[] = []
): RenamePlan {
  const files = new Map<string, string>();
  const dirs = new Map<string, string>();
  for (const path of paths) {
    if (path.length === 0 || !inScope(path, prefixes)) continue;
    const next = convertPath(path);
    if (next === path) continue;
    files.set(path, next);
    addDirRenames(path, next, dirs);
  }
  return { files, dirs, collisions: findCollisions(paths, files) };
}

/**
 * Where an old path (file, directory, or anything under a renamed directory)
 * ends up after the plan is applied.
 */
export function mapPath(plan: RenamePlan, path: string): string {
  const file = plan.files.get(path);
  if (file !== undefined) return file;
  const dir = plan.dirs.get(path);
  if (dir !== undefined) return dir;
  const segs = path.split('/');
  for (let i = segs.length - 1; i > 0; i -= 1) {
    const prefix = segs.slice(0, i).join('/');
    const mapped = plan.dirs.get(prefix);
    if (mapped !== undefined) return `${mapped}/${segs.slice(i).join('/')}`;
  }
  return path;
}
