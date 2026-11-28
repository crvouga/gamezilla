import { posix } from 'node:path';
import { type PathConditions, resolveExports } from 'resolve-pkg-maps';
import { isProductionSource } from './production-source';
import { sourceImports } from './source-imports';

type File = { readonly path: string; readonly text: string };

export type WorkspaceExports = { readonly exports?: PathConditions | null };

function privateNamedImport(
  spec: string,
  workspace: ReadonlyMap<string, WorkspaceExports>
): boolean {
  const [scope, name, ...path] = spec.split('/');
  const manifest = workspace.get(`${scope}/${name}`);
  if (!manifest) return false;
  const exports = manifest.exports;
  if (
    exports == null ||
    path.some((part) => /^(?:\.{1,2}|node_modules)$/i.test(part))
  )
    return true;
  const subpath = path.join('/');
  return ![
    ['types', 'browser', 'import'],
    ['bun', 'node', 'import'],
    ['node', 'require'],
    [],
  ].some((conditions) => {
    try {
      return resolveExports(exports, subpath, conditions).length > 0;
    } catch {
      return false;
    }
  });
}

export function privatePackageImports(options: {
  readonly dir: string;
  readonly files: readonly File[];
  readonly workspace: ReadonlyMap<string, WorkspaceExports>;
  readonly legacy: readonly string[];
}): readonly string[] {
  const remaining = new Set(options.legacy);
  const named = new Map<string, boolean>();
  const violations = new Set<string>();
  for (const file of options.files) {
    if (!/\.\.\/|@(?:apps|libs|pkgs)\/|\\/.test(file.text)) continue;
    for (const { specifier } of sourceImports(file.text, file.path)) {
      if (!specifier.startsWith('.')) {
        if (
          !specifier.startsWith('@') ||
          specifier === `@${options.dir}` ||
          specifier.startsWith(`@${options.dir}/`)
        )
          continue;
        if (!named.has(specifier))
          named.set(
            specifier,
            privateNamedImport(specifier, options.workspace)
          );
        if (named.get(specifier))
          violations.add(
            `${file.path}: ${specifier} is private; import a declared package export`
          );
        continue;
      }
      const target = posix.join(
        options.dir,
        posix.dirname(file.path),
        specifier
      );
      const installed =
        /(?:^|\/)node_modules\/@((?:apps|libs|pkgs)\/[^/]+)/.exec(target);
      const owner = installed?.[1] ?? target.split('/').slice(0, 2).join('/');
      if (owner === options.dir || !options.workspace.has(`@${owner}`))
        continue;
      const edge = `${file.path} -> ${target}`;
      if (
        options.legacy.includes(edge) &&
        !(file.path.startsWith('src/') && isProductionSource(file.path))
      )
        remaining.delete(edge);
      else
        violations.add(
          `${file.path}: ${specifier} reaches into @${owner}; import a declared package export`
        );
    }
  }
  return [
    ...violations,
    ...[...remaining].map(
      (edge) => `remove stale legacy private import: ${edge}`
    ),
  ];
}
