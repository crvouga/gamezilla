#!/usr/bin/env bun
/**
 * For each new flattened package, scan source imports and report missing
 * dependencies. Auto-fix when `--fix` is passed.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REPO = path.resolve(import.meta.dir, '..');
const PACKAGES = path.join(REPO, 'packages');
const FIX = process.argv.includes('--fix');

const NEW_PKGS = [
  'assert',
  'logger',
  'doppler',
  'i18n',
  'equal',
  'polyfill',
  'browser',
  'commit-hash-regex',
  'local-preview-api-origin',
  'ts-reset',
  'keyword',
  'uuid',
  'sqlite',
  'pub-sub',
  'async',
  'object-store',
  'secure-storage',
  'secret-store',
  'postgres',
  'static-file-server',
  'task-dag',
  'attribute',
  'message',
  'sql-client',
  'kv',
  'distributed-lock',
];

const CATALOG = 'catalog:';
const IMPORT_TO_DEP: Record<string, string> = {};
const NODE_BUILTINS = new Set([
  'fs',
  'fs/promises',
  'path',
  'os',
  'crypto',
  'http',
  'https',
  'url',
  'util',
  'stream',
  'events',
  'child_process',
  'process',
  'buffer',
  'assert',
  'zlib',
  'net',
  'tls',
  'querystring',
  'dns',
  'readline',
  'worker_threads',
  // bun runtime built-in (no npm package needed; @types/bun provides types)
  'bun',
]);

function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      out += c;
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') {
          out += src[i] + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += src[i];
        i++;
      }
      if (i < src.length) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.isFile()) out.push(full);
  }
  return out;
}

function depRoot(spec: string): string | null {
  if (spec.startsWith('.')) return null;
  if (spec.startsWith('node:')) return null;
  if (spec.startsWith('bun:')) return null;
  if (NODE_BUILTINS.has(spec)) return null;
  const parts = spec.split('/');
  const root = spec.startsWith('@')
    ? `${parts[0]}/${parts[1]}`
    : (parts[0] ?? '');
  return IMPORT_TO_DEP[root] ?? root;
}

const IMPORT_RE =
  /(?:from\s+['"]|require\s*\(\s*['"]|import\s*\(\s*['"]|^\s*import\s+['"])([^'"]+)['"]/gm;

let totalMissing = 0;
for (const pkgName of NEW_PKGS) {
  const pkgDir = path.join(PACKAGES, pkgName);
  if (!existsSync(pkgDir)) continue;
  const srcDir = path.join(pkgDir, 'src');
  if (!existsSync(srcDir)) continue;
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const declared = new Set([
    ...Object.keys(pkgJson.dependencies ?? {}),
    ...Object.keys(pkgJson.devDependencies ?? {}),
  ]);
  declared.add(`@gamezilla/${pkgName}`); // self-references are OK

  const found = new Set<string>();
  const foundDev = new Set<string>(); // only used by tests
  for (const file of walk(srcDir)) {
    if (!/\.(ts|tsx|cts|mts)$/.test(file)) continue;
    const isTest = /\.test\.(ts|tsx)$/.test(file);
    const raw = await readFile(file, 'utf8');
    const src = stripComments(raw);
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1];
      if (spec === undefined) continue;
      const root = depRoot(spec);
      if (root === null) continue;
      if (isTest) foundDev.add(root);
      else found.add(root);
    }
  }

  const missingRuntime: string[] = [];
  for (const d of found) {
    if (!declared.has(d)) missingRuntime.push(d);
  }
  const missingDev: string[] = [];
  for (const d of foundDev) {
    if (found.has(d)) continue; // already runtime
    if (!declared.has(d)) missingDev.push(d);
  }

  if (missingRuntime.length === 0 && missingDev.length === 0) continue;

  totalMissing += missingRuntime.length + missingDev.length;
  console.log(`@gamezilla/${pkgName}:`);
  for (const m of missingRuntime) console.log(`  missing dep: ${m}`);
  for (const m of missingDev) console.log(`  missing devDep: ${m}`);

  if (!FIX) continue;
  pkgJson.dependencies ??= {};
  pkgJson.devDependencies ??= {};
  for (const m of missingRuntime) {
    if (m.startsWith('@gamezilla/')) {
      pkgJson.dependencies[m] = 'workspace:*';
    } else {
      pkgJson.dependencies[m] = CATALOG;
    }
  }
  for (const m of missingDev) {
    if (m.startsWith('@gamezilla/')) {
      pkgJson.devDependencies[m] = 'workspace:*';
    } else {
      pkgJson.devDependencies[m] = CATALOG;
    }
  }
  pkgJson.dependencies = Object.fromEntries(
    Object.entries(pkgJson.dependencies).sort(([a], [b]) => a.localeCompare(b))
  );
  pkgJson.devDependencies = Object.fromEntries(
    Object.entries(pkgJson.devDependencies).sort(([a], [b]) =>
      a.localeCompare(b)
    )
  );
  await writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
  console.log(`  → fixed package.json`);
}

if (totalMissing === 0) {
  console.log('All new packages have complete deps.');
}
