#!/usr/bin/env bun
// @io-wall-ok — tools composition root

/**
 * Enforce product-lib vertical-slice isolation:
 *   use-cases/A must not import use-cases/B
 *   use-cases must not import root/ or public/
 *   root/client must not import use-cases server or shared
 *   root/server must not import use-cases client or root/client
 *   shared/ must not import use-cases/, root/, or public/
 *   public/ must not import root/
 */
import { dirname, join, relative, resolve } from 'node:path';
import { Glob } from 'bun';

const REPO_ROOT = join(import.meta.dirname, '../..');

const PRODUCT_LIBS = [
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
] as const;

const IMPORT_RE =
  /(?:\bfrom|\bimport\s*\(|\brequire\s*\()\s*['"](\.[^'"]+|@libs\/([^/'"]+)\/[^'"]+)['"]/g;

type Zone =
  | { kind: 'use-case'; name: string; runtime: string }
  | { kind: 'root'; runtime: string }
  | { kind: 'shared' }
  | { kind: 'public' }
  | { kind: 'other' };

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (_full, prefix: string) => prefix);
}

function zoneForRel(srcRel: string): Zone {
  const useCase = /^use-cases\/([^/]+)\/([^/]+)\//.exec(srcRel);
  if (useCase) {
    return { kind: 'use-case', name: useCase[1]!, runtime: useCase[2]! };
  }
  const root = /^root\/([^/]+)\//.exec(srcRel);
  if (root) {
    return { kind: 'root', runtime: root[1]! };
  }
  if (srcRel.startsWith('root/')) {
    return { kind: 'root', runtime: 'iso' };
  }
  if (srcRel.startsWith('shared/')) return { kind: 'shared' };
  if (srcRel.startsWith('public/')) return { kind: 'public' };
  return { kind: 'other' };
}

function violation(from: Zone, to: Zone): string | null {
  if (
    from.kind === 'use-case' &&
    to.kind === 'use-case' &&
    from.name !== to.name
  ) {
    return `use-case ${from.name} must not import use-case ${to.name}`;
  }
  if (
    from.kind === 'use-case' &&
    (to.kind === 'root' || to.kind === 'public')
  ) {
    return `use-cases must not import ${to.kind}/`;
  }
  if (
    from.kind === 'root' &&
    from.runtime === 'client' &&
    to.kind === 'use-case' &&
    (to.runtime === 'server' || to.runtime === 'shared')
  ) {
    return `root/client must not import use-cases/*/server or use-cases/*/shared`;
  }
  if (
    from.kind === 'root' &&
    from.runtime === 'server' &&
    to.kind === 'use-case' &&
    to.runtime === 'client'
  ) {
    return `root/server must not import use-cases/*/client`;
  }
  if (
    from.kind === 'root' &&
    from.runtime === 'server' &&
    to.kind === 'root' &&
    to.runtime === 'client'
  ) {
    return `root/server must not import root/client`;
  }
  if (
    from.kind === 'shared' &&
    (to.kind === 'use-case' || to.kind === 'root' || to.kind === 'public')
  ) {
    return `shared/ must not import ${to.kind}/`;
  }
  if (from.kind === 'public' && to.kind === 'root') {
    return `public/ must not import root/`;
  }
  return null;
}

function resolveImport(
  fromFile: string,
  spec: string,
  pkg: string,
  pkgSrc: string
): string | null {
  if (spec.startsWith('@libs/')) {
    const rest = spec.slice('@libs/'.length);
    const slash = rest.indexOf('/');
    if (slash < 0) return null;
    const name = rest.slice(0, slash);
    if (name !== pkg) return null;
    return rest.slice(slash + 1);
  }
  const abs = resolve(dirname(fromFile), spec);
  const rel = relative(pkgSrc, abs);
  if (rel.startsWith('..')) return null;
  return rel.replaceAll('\\', '/');
}

const violations: string[] = [];

for (const pkg of PRODUCT_LIBS) {
  const pkgSrc = join(REPO_ROOT, 'libs', pkg, 'src');
  const glob = new Glob('**/*.{ts,tsx}');
  for (const rel of glob.scanSync({ cwd: pkgSrc, absolute: false })) {
    if (rel.includes('.test.') || rel.includes('.spec.')) continue;
    const fromFile = join(pkgSrc, rel);
    const fromZone = zoneForRel(rel.replaceAll('\\', '/'));
    if (fromZone.kind === 'other') continue;
    const text = stripComments(await Bun.file(fromFile).text());
    for (const match of text.matchAll(IMPORT_RE)) {
      const spec = match[1];
      if (spec === undefined) continue;
      const targetRel = resolveImport(fromFile, spec, pkg, pkgSrc);
      if (targetRel === null) continue;
      const toZone = zoneForRel(targetRel);
      const reason = violation(fromZone, toZone);
      if (reason === null) continue;
      violations.push(`libs/${pkg}/src/${rel}: ${reason} (import ${spec})`);
    }
  }
}

if (violations.length > 0) {
  console.error('ci:use-case-isolation FAILED:');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log('ci:use-case-isolation OK');
