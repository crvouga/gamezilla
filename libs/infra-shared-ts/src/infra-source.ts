/**
 * The OpenTofu source tree as data: path → text, relative to
 * `libs/infra-shared-ts/tofu`. The reader (a script) owns the file system; the
 * model builder and renderer never touch it.
 */

export type TofuSources = ReadonlyMap<string, string>;

export type SourceFiles = {
  read(path: string): string | undefined;
  /** Files under `dir` matching a `fileset` glob, relative to `dir`. */
  fileset(dir: string, pattern: string): readonly string[];
  /** Direct children of `dir` with the given extension, sorted. */
  list(dir: string, extension: string): readonly string[];
};

/** Resolve `.` and `..` segments; never escapes the root. */
export function normalizePath(path: string): string {
  const out: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return out.join('/');
}

export function joinPath(base: string, relative: string): string {
  return normalizePath(`${base}/${relative}`);
}

export function dirnameOf(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

export function basenameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function globToRegExp(pattern: string): RegExp {
  let source = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern.charAt(i);
    if (c === '*' && pattern.charAt(i + 1) === '*') {
      source += '.*';
      i += 1;
    } else if (c === '*') source += '[^/]*';
    else if (c === '?') source += '[^/]';
    else source += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

export function sourceFiles(sources: TofuSources): SourceFiles {
  const paths = [...sources.keys()].sort();
  return {
    read: (path) => sources.get(normalizePath(path)),
    fileset: (dir, pattern) => {
      const base = normalizePath(dir);
      const prefix = base === '' ? '' : `${base}/`;
      const matcher = globToRegExp(pattern);
      return paths
        .filter(
          (p) => p.startsWith(prefix) && matcher.test(p.slice(prefix.length))
        )
        .map((p) => p.slice(prefix.length));
    },
    list: (dir, extension) => {
      const base = normalizePath(dir);
      return paths.filter(
        (p) => dirnameOf(p) === base && p.endsWith(extension)
      );
    },
  };
}
