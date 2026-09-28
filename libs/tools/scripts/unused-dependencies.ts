// @io-wall-ok — lint rule over a package's own files, run by lint-package.ts (scripts/**).
/**
 * A declared workspace dependency no file in the package uses.
 *
 * Turbo builds its task graph from `package.json`, so a declared dependency is
 * a cache invalidation: every change to it reruns this package's `tc`, `lint`,
 * `test` and `test:spec`, and everything downstream. One that nothing imports
 * buys that cost for nothing — the shell that once declared a board widget,
 * the app that declared every feature it no longer names. The opposite
 * mistake, importing what is not declared, is Biome's
 * `noUndeclaredDependencies`.
 *
 * "Used" is textual and generous: the package name followed by a quote,
 * backtick or `/` anywhere in the package's tracked sources, configs or
 * `package.json` scripts. Bun symlinks every workspace package at the root, so
 * dropping one never breaks resolution; it only narrows the graph.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Manifest = {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly scripts?: Record<string, string>;
};

const WORKSPACE_SCOPE = /^@(apps|libs|pkgs)\//;
const TEXT_FILE = /\.(ts|tsx|js|mjs|cjs|mts|cts|json|jsonc|toml|html|css)$/;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Declared `@apps/*` / `@libs/*` / `@pkgs/*` dependencies of the package at
 * `pkgDir` that none of `files` (package-relative, as `git ls-files` lists
 * them) mentions.
 */
export function unusedWorkspaceDependencies(
  pkgDir: string,
  files: readonly string[]
): readonly string[] {
  const manifest = JSON.parse(
    readFileSync(join(pkgDir, 'package.json'), 'utf8')
  ) as Manifest;
  const texts = [JSON.stringify(manifest.scripts ?? {})];
  for (const file of files) {
    if (file === 'package.json' || !TEXT_FILE.test(file)) continue;
    texts.push(readFileSync(join(pkgDir, file), 'utf8'));
  }
  const corpus = texts.join('\n');
  const declared = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ].filter((name) => WORKSPACE_SCOPE.test(name));
  return declared.filter(
    (name) => !new RegExp(`${escapeRegExp(name)}['"\`/]`).test(corpus)
  );
}
