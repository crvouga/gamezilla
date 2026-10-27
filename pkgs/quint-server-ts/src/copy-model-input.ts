// @io-wall-ok — preserves a private compiler input's complete import graph.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { quintImportPaths } from '@pkgs/quint-shared-ts/imports';

/** Copy sources without compiling them; the official checker validates the copy. */
export function copyModelInput(
  specPath: string,
  root: string,
  transform: (source: string, path: string) => string
): string {
  const visited = new Set<string>();
  // An absolute path, less its root (`/` or a Windows drive), under `root`.
  const destination = (path: string) =>
    join(root, path.replace(/^[A-Za-z]:/, '').replace(/^[/\\]+/, ''));
  const copy = (path: string): void => {
    if (visited.has(path)) return;
    visited.add(path);
    const source = readFileSync(path, 'utf8');
    const target = destination(path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, transform(source, path));
    for (const from of quintImportPaths(source)) {
      const dependency = resolve(
        dirname(path),
        from.endsWith('.qnt') ? from : `${from}.qnt`
      );
      if (existsSync(dependency)) copy(dependency);
    }
  };
  const absolute = resolve(specPath);
  copy(absolute);
  return destination(absolute);
}
