#!/usr/bin/env bun
/**
 * One-shot migration: flatten `packages/lib` into ~26 micro-packages.
 *
 * Run from repo root: `bun run scripts/flatten-lib.ts`.
 *
 * Idempotent for missing source dirs (logs "skip"), but **destructive** —
 * commit/stash before running.
 */
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REPO = path.resolve(import.meta.dir, '..');
const LIB_SRC = path.join(REPO, 'packages/lib/src');
const PACKAGES = path.join(REPO, 'packages');

type Pkg = {
  /** Final package name segment after `@gamezilla/`. */
  name: string;
  /** 'dir' = move `packages/lib/src/<sourcePath>/` recursively; 'file' = single file. */
  kind: 'dir' | 'file';
  /** Source path within `packages/lib/src`. */
  sourcePath: string;
  /** Does the moved tree have an `index.ts`? Controls `"."` export. */
  hasIndex: boolean;
  /** Other new-package names this package depends on (workspace deps). */
  internalDeps: string[];
  /** npm deps with explicit version strings. */
  npmDeps?: Record<string, string>;
  /** npm devDeps. */
  npmDevDeps?: Record<string, string>;
  /** Does this package contain `.tsx` files (needs jsx settings)? */
  hasTsx?: boolean;
  /** Does this package have tests / use bun:test? Adds `@types/bun`. */
  hasTests?: boolean;
};

const CAT = 'catalog:';

// ---------------------------------------------------------------------------
// Package definitions
// ---------------------------------------------------------------------------
const PKGS: Pkg[] = [
  // ---- Wave 1: leaves ----
  {
    name: 'assert',
    kind: 'dir',
    sourcePath: 'assert',
    hasIndex: true,
    internalDeps: [],
    npmDeps: { 'expo-clipboard': CAT, 'react-native': CAT },
    hasTests: false,
  },
  {
    name: 'logger',
    kind: 'dir',
    sourcePath: 'logger',
    hasIndex: true,
    internalDeps: [],
    npmDeps: { react: CAT },
    npmDevDeps: { '@types/react': CAT },
    hasTsx: true,
  },
  {
    name: 'doppler',
    kind: 'dir',
    sourcePath: 'doppler',
    hasIndex: true,
    internalDeps: [],
  },
  {
    name: 'i18n',
    kind: 'dir',
    sourcePath: 'i18n',
    hasIndex: true,
    internalDeps: [],
  },
  {
    name: 'equal',
    kind: 'dir',
    sourcePath: 'equal',
    hasIndex: false,
    internalDeps: [],
    hasTests: true,
  },
  {
    name: 'polyfill',
    kind: 'dir',
    sourcePath: 'polyfill',
    hasIndex: true,
    internalDeps: [],
    npmDeps: { buffer: CAT, 'expo-crypto': CAT },
  },
  {
    name: 'browser',
    kind: 'dir',
    sourcePath: 'browser',
    hasIndex: false,
    internalDeps: [],
  },
  {
    name: 'commit-hash-regex',
    kind: 'file',
    sourcePath: 'commit-hash-regex.ts',
    hasIndex: true,
    internalDeps: [],
  },
  {
    name: 'local-preview-api-origin',
    kind: 'file',
    sourcePath: 'default-local-preview-api-origin.ts',
    hasIndex: true,
    internalDeps: [],
  },
  {
    name: 'ts-reset',
    kind: 'file',
    sourcePath: 'ts-reset.ts',
    hasIndex: true,
    internalDeps: [],
    npmDeps: { '@total-typescript/ts-reset': CAT },
  },

  // ---- Wave 2: depends on wave 1 ----
  {
    name: 'keyword',
    kind: 'dir',
    sourcePath: 'keyword',
    hasIndex: true,
    internalDeps: ['assert'],
    hasTests: true,
  },
  {
    name: 'uuid',
    kind: 'dir',
    sourcePath: 'uuid',
    hasIndex: true,
    internalDeps: ['assert'],
  },
  {
    name: 'sqlite',
    kind: 'dir',
    sourcePath: 'sqlite',
    hasIndex: true,
    internalDeps: ['assert'],
    hasTests: true,
  },
  {
    name: 'pub-sub',
    kind: 'dir',
    sourcePath: 'pub-sub',
    hasIndex: false,
    internalDeps: ['assert'],
    hasTests: true,
  },
  {
    name: 'async',
    kind: 'dir',
    sourcePath: 'async',
    hasIndex: false,
    internalDeps: ['logger'],
    npmDeps: { react: CAT },
    npmDevDeps: { '@types/react': CAT },
  },
  {
    name: 'object-store',
    kind: 'dir',
    sourcePath: 'object-store',
    hasIndex: false,
    internalDeps: [],
    npmDeps: {
      'expo-file-system': CAT,
      react: CAT,
      'react-native': CAT,
    },
    npmDevDeps: { '@types/react': CAT },
    hasTsx: true,
    hasTests: true,
  },
  {
    name: 'secure-storage',
    kind: 'dir',
    sourcePath: 'secure-storage',
    hasIndex: true,
    internalDeps: ['assert'],
    npmDeps: {
      'expo-secure-store': CAT,
      react: CAT,
    },
    npmDevDeps: { '@types/react': CAT },
    hasTests: true,
  },
  {
    name: 'secret-store',
    kind: 'dir',
    sourcePath: 'secret-store',
    hasIndex: true,
    internalDeps: ['doppler'],
    hasTests: true,
  },
  {
    name: 'postgres',
    kind: 'dir',
    sourcePath: 'postgres',
    hasIndex: false,
    internalDeps: ['assert'],
    npmDeps: {
      '@electric-sql/pglite': CAT,
      '@electric-sql/pglite-socket': CAT,
    },
    hasTests: true,
  },
  {
    name: 'static-file-server',
    kind: 'dir',
    sourcePath: 'static-file-server',
    hasIndex: false,
    internalDeps: [],
    hasTests: true,
  },
  {
    name: 'task-dag',
    kind: 'dir',
    sourcePath: 'task-dag',
    hasIndex: true,
    internalDeps: [],
  },

  // ---- Wave 3 ----
  {
    name: 'attribute',
    kind: 'dir',
    sourcePath: 'attribute',
    hasIndex: true,
    internalDeps: ['assert', 'keyword'],
    hasTests: true,
  },
  {
    name: 'message',
    kind: 'dir',
    sourcePath: 'message',
    hasIndex: true,
    internalDeps: ['assert', 'keyword'],
    hasTests: true,
  },
  {
    name: 'sql-client',
    kind: 'dir',
    sourcePath: 'sql-client',
    hasIndex: false,
    internalDeps: ['assert', 'pub-sub', 'sqlite'],
    npmDeps: {
      pg: CAT,
      '@neondatabase/serverless': CAT,
      'expo-sqlite': CAT,
      'sql.js': CAT,
      'absurd-sql': CAT,
      '@jlongster/sql.js': CAT,
      'react-native': CAT,
      react: CAT,
    },
    npmDevDeps: {
      '@types/pg': CAT,
      '@types/sql.js': CAT,
      '@types/react': CAT,
    },
    hasTsx: true,
    hasTests: true,
  },

  // ---- Wave 4: top ----
  {
    name: 'kv',
    kind: 'dir',
    sourcePath: 'kv',
    hasIndex: false,
    internalDeps: ['assert', 'keyword', 'attribute', 'sql-client', 'logger'],
    npmDeps: {
      pg: CAT,
      '@react-native-async-storage/async-storage': CAT,
      'react-native': CAT,
      react: CAT,
    },
    npmDevDeps: {
      '@types/pg': CAT,
      '@types/react': CAT,
    },
    hasTests: true,
  },
  {
    name: 'distributed-lock',
    kind: 'dir',
    sourcePath: 'distributed-lock',
    hasIndex: false,
    internalDeps: ['assert', 'keyword', 'attribute', 'kv'],
    hasTests: true,
  },
];

const PKG_NAMES = new Set(PKGS.map((p) => p.name));

// Old-import → new-package-name map (for codemod across repo).
// Keys: lib subpath segment (first segment after `@gamezilla/lib/`).
const RENAME: Record<string, string> = {
  // Renamed root files
  'default-local-preview-api-origin': 'local-preview-api-origin',
  // All directory packages keep their name
};

function newNameFor(oldFirstSegment: string): string {
  return RENAME[oldFirstSegment] ?? oldFirstSegment;
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------
function walkDir(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkDir(full, out);
    else if (ent.isFile()) out.push(full);
  }
  return out;
}

async function moveTree(src: string, dest: string): Promise<void> {
  mkdirSync(dest, { recursive: true });
  for (const ent of readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      await moveTree(from, to);
    } else {
      await rename(from, to);
    }
  }
  await rm(src, { recursive: true, force: true });
}

async function moveFile(src: string, dest: string): Promise<void> {
  mkdirSync(path.dirname(dest), { recursive: true });
  await rename(src, dest);
}

// ---------------------------------------------------------------------------
// Per-package scaffold writers
// ---------------------------------------------------------------------------
function packageJsonFor(pkg: Pkg): string {
  const exports: Record<string, unknown> = {};
  if (pkg.hasIndex) {
    exports['.'] =
      pkg.hasTsx && pkg.name === 'logger' ? './src/index.ts' : './src/index.ts';
  }
  exports['./*'] = ['./src/*.ts', './src/*.tsx', './src/*/index.ts'];

  const dependencies: Record<string, string> = {};
  for (const dep of pkg.internalDeps) {
    dependencies[`@gamezilla/${dep}`] = 'workspace:*';
  }
  Object.assign(dependencies, pkg.npmDeps ?? {});

  const devDependencies: Record<string, string> = {
    '@types/bun': CAT,
    typescript: CAT,
  };
  Object.assign(devDependencies, pkg.npmDevDeps ?? {});

  const scripts: Record<string, string> = {
    lint: 'eslint . --max-warnings 0',
    tc: 'tsc --noEmit',
    test: 'bun test --pass-with-no-tests',
  };

  const body = {
    name: `@gamezilla/${pkg.name}`,
    version: '0.0.0',
    private: true,
    exports,
    scripts,
    dependencies: sortObject(dependencies),
    devDependencies: sortObject(devDependencies),
  };
  return JSON.stringify(body, null, 2) + '\n';
}

function sortObject<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))
  ) as T;
}

function tsconfigFor(pkg: Pkg): string {
  // Mirror existing micro-packages — extend root tsconfig, include ts-reset.
  // For the ts-reset package itself, do NOT self-include.
  const include: string[] = [];
  if (pkg.name !== 'ts-reset') {
    include.push('../ts-reset/src/index.ts');
  }
  include.push('./src/**/*.ts');
  if (pkg.hasTsx) include.push('./src/**/*.tsx');
  include.push('./src/**/*.d.ts');
  return (
    JSON.stringify(
      {
        extends: '../../tsconfig.json',
        include,
        exclude: ['node_modules'],
      },
      null,
      2
    ) + '\n'
  );
}

function eslintConfigFor(pkg: Pkg): string {
  // Mirror lib's eslint.config.js but without lib-specific file overrides.
  // Packages with .tsx files get the lingui block.
  const hasTsx = pkg.hasTsx === true;
  const linguiBlock = hasTsx
    ? `
  {
    files: ['**/*.tsx'],
    plugins: {
      gamezillaI18n: eslintPluginGamezillaI18n,
      lingui: eslintPluginLingui,
    },
    rules: {
      // Design-system / utility packages: product copy is enforced in packages/client.
      'gamezillaI18n/text-must-be-trans': 'off',
      ...linguiRules(),
      'lingui/no-unlocalized-strings': 'off',
    },
  },`
    : '';

  return `const eslintPluginGamezillaI18n = require('../eslint-rules/gamezilla-i18n.cjs');
const eslintPluginLingui = require('eslint-plugin-lingui');
const { createSharedBlocks } = require('../eslint-rules/base-config.cjs');
const { linguiRules } = require('../eslint-rules/lingui-rules.cjs');

module.exports = [
  ...createSharedBlocks(__dirname),${linguiBlock}
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'lingui/no-unlocalized-strings': 'off',
      'lingui/t-call-in-function': 'off',
      'lingui/no-trans-inside-trans': 'off',
      'lingui/no-expression-in-message': 'off',
      'lingui/no-single-tag-to-translate': 'off',
      'lingui/no-single-variables-to-translate': 'off',
      'gamezillaI18n/text-must-be-trans': 'off',
    },
  },
];
`;
}

// ---------------------------------------------------------------------------
// Codemod helpers
// ---------------------------------------------------------------------------
const IMPORT_RE =
  /(from\s+['"]|import\s*\(\s*['"]|require\s*\(\s*['"]|^\s*import\s+['"]|\/\/\/\s*<reference\s+path=['"])([^'"]+)(['"])/gm;

/**
 * Rewrite all `@gamezilla/lib/<seg>[/...]` specifiers to `@gamezilla/<new>[/...]`.
 * Also leaves a `@gamezilla/lib` bare import untouched (none exist).
 */
function rewriteRepoSpecifier(spec: string): string {
  // bare `@gamezilla/lib`
  if (spec === '@gamezilla/lib') return spec;
  const prefix = '@gamezilla/lib/';
  if (!spec.startsWith(prefix)) return spec;
  const rest = spec.slice(prefix.length);
  const slashIdx = rest.indexOf('/');
  const first = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
  const tail = slashIdx === -1 ? '' : rest.slice(slashIdx);
  const newFirst = newNameFor(first);
  return `@gamezilla/${newFirst}${tail}`;
}

/**
 * Rewrite a relative specifier inside a moved file:
 *  - `../<other-pkg>` or `../<other-pkg>/<tail>` → `@gamezilla/<other-pkg>[/<tail>]`
 *  - leaves `./...` and `../<intra>/...` alone
 *
 * Knows the set of new package names.
 */
function rewriteIntraPackageSpecifier(spec: string): string {
  if (!spec.startsWith('../')) return spec;
  const rest = spec.slice(3);
  const slashIdx = rest.indexOf('/');
  const first = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
  if (!PKG_NAMES.has(first)) return spec;
  const tail = slashIdx === -1 ? '' : rest.slice(slashIdx);
  return `@gamezilla/${first}${tail}`;
}

async function rewriteFileImports(
  filePath: string,
  rewriter: (spec: string) => string
): Promise<void> {
  const src = await readFile(filePath, 'utf8');
  let changed = false;
  const next = src.replace(IMPORT_RE, (_m, lead, spec, trail) => {
    const updated = rewriter(spec);
    if (updated !== spec) changed = true;
    return `${lead}${updated}${trail}`;
  });
  if (changed) await writeFile(filePath, next);
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------
async function extractPackage(pkg: Pkg): Promise<void> {
  const dest = path.join(PACKAGES, pkg.name);
  const srcDest = path.join(dest, 'src');
  const sourceAbs = path.join(LIB_SRC, pkg.sourcePath);
  if (!existsSync(sourceAbs)) {
    console.log(`  skip (no source): ${pkg.sourcePath}`);
    return;
  }
  if (existsSync(dest)) {
    console.log(`  skip (dest exists): packages/${pkg.name}`);
    return;
  }

  mkdirSync(srcDest, { recursive: true });

  if (pkg.kind === 'dir') {
    await moveTree(sourceAbs, srcDest);
  } else {
    // single-file package: move the file to src/index.ts
    await moveFile(sourceAbs, path.join(srcDest, 'index.ts'));
  }

  // Scaffold files
  await writeFile(path.join(dest, 'package.json'), packageJsonFor(pkg));
  await writeFile(path.join(dest, 'tsconfig.json'), tsconfigFor(pkg));
  await writeFile(path.join(dest, 'eslint.config.js'), eslintConfigFor(pkg));

  // Rewrite intra-package relative imports → workspace package imports
  for (const file of walkDir(srcDest)) {
    if (!/\.(ts|tsx|cts|mts)$/.test(file)) continue;
    await rewriteFileImports(file, rewriteIntraPackageSpecifier);
  }

  console.log(`  extracted: @gamezilla/${pkg.name}`);
}

async function codemodRepo(): Promise<void> {
  // Walk every TS/TSX file in the repo except node_modules / packages/lib
  // (lib is being deleted; nothing inside it should be touched any more).
  const roots = [PACKAGES, path.join(REPO, 'scripts')];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const file of walkDir(root)) {
      if (file.includes(`${path.sep}node_modules${path.sep}`)) continue;
      if (
        file.includes(`${path.sep}lib${path.sep}`) &&
        file.includes(`packages${path.sep}lib`)
      ) {
        // skip files still inside packages/lib (will be deleted)
        continue;
      }
      if (!/\.(ts|tsx|cts|mts)$/.test(file)) continue;
      if (
        file.endsWith('.d.ts') === false &&
        !file.endsWith('.ts') &&
        !file.endsWith('.tsx') &&
        !file.endsWith('.cts') &&
        !file.endsWith('.mts')
      ) {
        continue;
      }
      await rewriteFileImports(file, rewriteRepoSpecifier);
    }
  }
}

// ---------------------------------------------------------------------------
// Update consumer package.json files: replace @gamezilla/lib with granular deps
// ---------------------------------------------------------------------------
/**
 * Scan a package's source tree to detect which `@gamezilla/<new>` deps it
 * actually imports, then rewrite its `package.json` to declare only those.
 *
 * Mirrors the lib's own runtime deps when re-creating granular sets — if a
 * consumer used to depend on lib for `pg` (via sql-client transitively), it
 * now depends on `@gamezilla/sql-client` which itself declares `pg`.
 */
async function trimConsumerDeps(pkgDir: string): Promise<void> {
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (!existsSync(pkgJsonPath)) return;
  const raw = await readFile(pkgJsonPath, 'utf8');
  const json = JSON.parse(raw) as {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = json.dependencies ?? {};
  if (!('@gamezilla/lib' in deps)) return;

  // Compute set of @gamezilla/<new> packages this consumer imports.
  const imports = new Set<string>();
  const srcRoots = ['src', 'scripts'].map((d) => path.join(pkgDir, d));
  for (const root of srcRoots) {
    if (!existsSync(root)) continue;
    for (const file of walkDir(root)) {
      if (!/\.(ts|tsx|cts|mts)$/.test(file)) continue;
      const src = await readFile(file, 'utf8');
      for (const m of src.matchAll(/@gamezilla\/([a-z0-9-]+)/g)) {
        const name = m[1];
        if (name === undefined) continue;
        if (PKG_NAMES.has(name)) imports.add(name);
      }
    }
  }

  delete deps['@gamezilla/lib'];
  for (const name of imports) {
    deps[`@gamezilla/${name}`] = 'workspace:*';
  }
  json.dependencies = sortObject(deps);

  await writeFile(pkgJsonPath, JSON.stringify(json, null, 2) + '\n');
  console.log(
    `  trimmed deps: ${json.name ?? pkgDir}  → +${imports.size} granular`
  );
}

// ---------------------------------------------------------------------------
// Update tsconfigs referencing ../lib/src/ts-reset.ts
// ---------------------------------------------------------------------------
async function updateConsumerTsconfigs(): Promise<void> {
  const consumers = readdirSync(PACKAGES);
  for (const pkg of consumers) {
    const tsconfigPath = path.join(PACKAGES, pkg, 'tsconfig.json');
    if (!existsSync(tsconfigPath)) continue;
    const raw = await readFile(tsconfigPath, 'utf8');
    if (!raw.includes('../lib/src/ts-reset.ts')) continue;
    const next = raw.replace(
      /\.\.\/lib\/src\/ts-reset\.ts/g,
      '../ts-reset/src/index.ts'
    );
    await writeFile(tsconfigPath, next);
    console.log(`  updated tsconfig: ${pkg}`);
  }
}

// ---------------------------------------------------------------------------
// Update root files (tsconfig, knip, lingui, package.json)
// ---------------------------------------------------------------------------
async function updateRootTsconfig(): Promise<void> {
  const p = path.join(REPO, 'tsconfig.json');
  const raw = await readFile(p, 'utf8');
  // Remove `"@gamezilla/lib/*": ["./packages/lib/src/*"],` line
  // Remove `packages/lib/src/...` include entries
  // Replace the standalone ts-reset include with new path
  let next = raw;
  next = next.replace(
    /\s*"@gamezilla\/lib\/\*": \["\.\/packages\/lib\/src\/\*"\],\n/,
    '\n'
  );
  next = next.replace(
    /\s*"packages\/lib\/src\/ts-reset\.ts",\n/,
    '\n    "packages/ts-reset/src/index.ts",\n'
  );
  next = next.replace(/\s*"packages\/lib\/src\/\*\*\/\*\.ts",\n/, '\n');
  // Collapse any accidental empty lines
  next = next.replace(/\n\n+/g, '\n\n');
  // Add include lines for every new package src/**
  // Detect the `"include": [` array end and inject before it closes? Simpler:
  // append fresh include entries before the `"include"` close bracket.
  next = next.replace(
    /("include":\s*\[)([\s\S]*?)(\n\s*\])/,
    (_full, open, body, close) => {
      const additions = PKGS.map(
        (pk) =>
          `    "packages/${pk.name}/src/**/*.ts",${pk.hasTsx ? `\n    "packages/${pk.name}/src/**/*.tsx",` : ''}`
      ).join('\n');
      return `${open}${body}\n${additions}${close}`;
    }
  );
  await writeFile(p, next);
  console.log('  updated root tsconfig.json');
}

async function updateKnip(): Promise<void> {
  const p = path.join(REPO, 'knip.jsonc');
  const raw = await readFile(p, 'utf8');
  const next = raw
    .replace(
      'packages/lib/src/sql-client/absurd-sql-db.worker.ts',
      'packages/sql-client/src/absurd-sql-db.worker.ts'
    )
    .replace(/\s*"packages\/lib\/src\/ts-reset\.ts",\n/, '\n');
  await writeFile(p, next);
  console.log('  updated knip.jsonc');
}

async function updateLinguiConfig(): Promise<void> {
  const p = path.join(REPO, 'lingui.config.cjs');
  const raw = await readFile(p, 'utf8');
  const next = raw.replace(/'<rootDir>\/packages\/lib\/src',\n/, '');
  await writeFile(p, next);
  console.log('  updated lingui.config.cjs');
}

async function updateRootPackageJson(): Promise<void> {
  const p = path.join(REPO, 'package.json');
  const raw = await readFile(p, 'utf8');
  const next = raw.replace(
    'packages/client/src/i18n packages/lib/src/i18n packages/patch-db-example/src/i18n packages/room-example/src/i18n',
    'packages/client/src/i18n packages/patch-db-example/src/i18n packages/room-example/src/i18n'
  );
  await writeFile(p, next);
  console.log('  updated root package.json');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('flatten-lib: extracting packages...');
  for (const pkg of PKGS) {
    await extractPackage(pkg);
  }

  console.log('flatten-lib: codemod repo-wide imports...');
  await codemodRepo();

  console.log('flatten-lib: trimming consumer package.json deps...');
  const consumers = readdirSync(PACKAGES);
  for (const c of consumers) {
    const dir = path.join(PACKAGES, c);
    if (!statSync(dir).isDirectory()) continue;
    await trimConsumerDeps(dir);
  }

  console.log('flatten-lib: updating consumer tsconfigs...');
  await updateConsumerTsconfigs();

  console.log('flatten-lib: updating root tsconfig...');
  await updateRootTsconfig();

  console.log('flatten-lib: updating root knip / lingui / package.json...');
  await updateKnip();
  await updateLinguiConfig();
  await updateRootPackageJson();

  // Verify packages/lib/src is now empty (ignoring src/ container)
  const libSrcRemaining = existsSync(LIB_SRC) ? readdirSync(LIB_SRC) : [];
  if (libSrcRemaining.length > 0) {
    console.log(
      `WARNING: packages/lib/src still contains: ${libSrcRemaining.join(', ')}`
    );
  } else {
    // Safe to remove packages/lib
    if (existsSync(path.join(REPO, 'packages/lib'))) {
      await rm(path.join(REPO, 'packages/lib'), {
        recursive: true,
        force: true,
      });
      console.log('  deleted packages/lib');
    }
  }

  console.log('flatten-lib: done.');
}

await main();
