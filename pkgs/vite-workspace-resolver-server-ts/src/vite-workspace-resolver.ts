// @io-wall-ok — build-tool plugin: reads workspace package manifests from disk.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import type { Plugin } from 'vite';

type ExportTarget =
  | string
  | readonly string[]
  | Readonly<Record<string, unknown>>;

type PackageManifest = {
  readonly name?: string;
  readonly exports?: Readonly<Record<string, ExportTarget>>;
};

export type WorkspaceResolverOptions = {
  /** Monorepo root containing the tier directories. */
  readonly repoRoot: string;
  /** npm scope → tier directory, e.g. `{ '@pkgs': 'pkgs' }`. */
  readonly scopes: Readonly<Record<string, string>>;
};

const manifestCache = new Map<string, PackageManifest | null>();

function readManifest(dir: string): PackageManifest | null {
  const cached = manifestCache.get(dir);
  if (cached !== undefined) return cached;
  const file = resolve(dir, 'package.json');
  const manifest = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as PackageManifest)
    : null;
  manifestCache.set(dir, manifest);
  return manifest;
}

function targetCandidates(target: ExportTarget): readonly string[] {
  if (typeof target === 'string') return [target];
  if (Array.isArray(target)) return target as readonly string[];
  // Conditional exports: prefer source-ish conditions, then default.
  const record = target as Readonly<Record<string, unknown>>;
  const out: string[] = [];
  for (const key of ['browser', 'import', 'default']) {
    const value = record[key];
    if (value !== undefined)
      out.push(...targetCandidates(value as ExportTarget));
  }
  return out;
}

/**
 * Match `subpath` (e.g. `./solid`) against the exports map, expanding a single
 * `*` wildcard. Returns concrete target paths (relative to the package).
 */
export function expandExportTargets(
  exportsMap: Readonly<Record<string, ExportTarget>>,
  subpath: string
): readonly string[] {
  const exact = exportsMap[subpath];
  if (exact !== undefined) return targetCandidates(exact);
  const patterns = Object.entries(exportsMap).sort(
    ([a], [b]) => b.indexOf('*') - a.indexOf('*') || b.length - a.length
  );
  for (const [pattern, target] of patterns) {
    const star = pattern.indexOf('*');
    if (star === -1) continue;
    const head = pattern.slice(0, star);
    const tail = pattern.slice(star + 1);
    if (
      subpath.length < head.length + tail.length ||
      !subpath.startsWith(head) ||
      !subpath.endsWith(tail)
    ) {
      continue;
    }
    const wildcard = subpath.slice(head.length, subpath.length - tail.length);
    return targetCandidates(target).map((t) => t.replaceAll('*', wildcard));
  }
  return [];
}

/**
 * Resolve workspace imports (`@pkgs/x/feature`) by honouring array fallback
 * targets in `exports` (`["./src/<star>.ts", "./src/<star>.tsx", "./src/<star>/index.ts"]`):
 * Vite/Node take the first *syntactically valid* target, Bun takes the first
 * that exists on disk. This plugin mirrors Bun so `.tsx` subpaths resolve.
 */
export function workspaceExportsResolver(
  options: WorkspaceResolverOptions
): Plugin {
  const scopePattern = new RegExp(
    `^(${Object.keys(options.scopes)
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})/([^/]+)(/.*)?$`
  );
  return {
    name: 'workspace-exports-resolver',
    enforce: 'pre',
    resolveId(source) {
      const match = scopePattern.exec(source);
      if (match === null) return null;
      const [, scope = '', name = '', rest = ''] = match;
      const tier = options.scopes[scope];
      if (tier === undefined) return null;
      const dir = resolve(options.repoRoot, tier, name);
      const manifest = readManifest(dir);
      if (manifest?.exports === undefined) return null;
      const subpath = rest === '' ? '.' : `.${rest}`;
      for (const target of expandExportTargets(manifest.exports, subpath)) {
        const abs = resolve(dir, target);
        // Vite gives relative imports `/` ids; a `\` id on Windows would
        // make a module imported both ways two modules.
        if (existsSync(abs)) return slashPath(abs);
      }
      return null;
    },
  };
}

/** The four monorepo tiers. */
export const DEFAULT_WORKSPACE_SCOPES: Readonly<Record<string, string>> = {
  '@pkgs': 'pkgs',
  '@libs': 'libs',
  '@apps': 'apps',
  '@product': 'product',
};
