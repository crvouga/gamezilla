#!/usr/bin/env bun
// @io-wall-ok — tools composition root

/**
 * Product @libs import surface:
 *   other libs → @libs/<pkg>/public/…
 *   apps + test → @libs/<pkg>/public/… or @libs/<pkg>/root/…
 *   never use-cases/ or shared/ from outside the package
 *
 * Exempt targets (no use-case layout): db, infra, games, runtime, dst-handles.
 */
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Glob } from 'bun';
import {
  discoverPackagesWithTier,
  REPO_ROOT,
  stripComments,
  stripTypeOnlyImports,
} from './workspace-package-import-graph';

const PRODUCT_LIBS = new Set([
  'auth',
  'chess',
  'client-config',
  'friends',
  'notifications',
  'profile',
  'search',
  'spaces',
  'billing',
  'user-search',
]);

const DEEP_IMPORT_RE =
  /(?:\bfrom|\bimport\s*\(|\brequire\s*\()\s*['"]@libs\/([^/'"]+)\/([^'"]+)['"]/g;

type Offense = {
  readonly file: string;
  readonly spec: string;
  readonly reason: string;
};

function allowedForImporter(importerTier: string, rest: string): string | null {
  if (rest.startsWith('use-cases/') || rest.startsWith('shared/')) {
    return 'must not import use-cases/ or shared/ from outside the package';
  }
  if (importerTier === 'libs') {
    if (rest === 'public' || rest.startsWith('public/')) return null;
    return 'libs may import @libs/<pkg>/public/ only';
  }
  if (importerTier === 'apps' || importerTier === 'test') {
    if (
      rest === 'public' ||
      rest === 'root' ||
      rest.startsWith('public/') ||
      rest.startsWith('root/')
    ) {
      return null;
    }
    return 'apps/test may import @libs/<pkg>/public/ or @libs/<pkg>/root/';
  }
  return null;
}

const offenses: Offense[] = [];
const packages = discoverPackagesWithTier();

for (const [scopedName, info] of packages) {
  if (info.tier === 'pkgs') continue;
  const glob = new Glob('**/*.{ts,tsx,mts,cts}');
  for (const rel of glob.scanSync({ cwd: info.dir, absolute: false })) {
    if (rel.startsWith('node_modules/') || rel.startsWith('dist/')) continue;
    const filePath = join(info.dir, rel);
    let source: string;
    try {
      source = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    source = stripTypeOnlyImports(stripComments(source));
    for (const match of source.matchAll(DEEP_IMPORT_RE)) {
      const targetPkg = match[1];
      const rest = match[2];
      if (targetPkg === undefined || rest === undefined) continue;
      if (!PRODUCT_LIBS.has(targetPkg)) continue;
      const selfName = scopedName.slice('@libs/'.length);
      if (info.tier === 'libs' && selfName === targetPkg) continue;
      const reason = allowedForImporter(info.tier, rest);
      if (reason === null) continue;
      offenses.push({
        file: relative(REPO_ROOT, filePath),
        spec: `@libs/${targetPkg}/${rest}`,
        reason,
      });
    }
  }
}

if (offenses.length > 0) {
  console.error('ci:libs-import-surface FAILED:');
  for (const o of offenses) {
    console.error(`  ${o.file}: ${o.reason} (${o.spec})`);
  }
  process.exit(1);
}
console.log('ci:libs-import-surface OK');
