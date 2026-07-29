#!/usr/bin/env bun
/**
 * Fail-fast guardrail: enforce the workspace tier import pyramid.
 *
 *   apps -> libs, pkgs   (apps may compose anything)
 *   libs -> pkgs only    (libs may not import apps)
 *   pkgs -> pkgs only    (pkgs is the leaf; no upward imports)
 *
 * Why a custom script (not `dependency-cruiser` alone): depcruise's
 * `doNotFollow.path: 'node_modules'` skips workspace symlinks, so cross-package
 * `@apps|@libs|@pkgs/<name>` imports are never traversed (bun resolves
 * workspace packages through node_modules symlinks). Same reason
 * `tooling/scripts/check-circular-deps.ts` exists.
 *
 * Two passes per package:
 *   1. Source scan -- regex over `**\/*.{ts,tsx,mts,cts}` for `@<tier>/<name>`
 *      imports/requires/dynamic imports (comments + type-only stripped).
 *   2. `package.json` workspace deps -- any `dependencies` or `devDependencies`
 *      pinned to `workspace:*` whose key is `@<otherTier>/...` and breaks the
 *      tier rule.
 *
 * The script fails loud with grouped, actionable violations; exits 0 with a
 * summary count when clean.
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { Glob } from 'bun';
import {
  REPO_ROOT,
  TIER_DIRS,
  TIER_IMPORT_PATTERN,
  discoverPackagesWithTier,
  stripComments,
  stripTypeOnlyImports,
  type PackageInfo,
  type PackageName,
  type Tier,
} from './workspace-package-import-graph';

/** Tiers that the key tier is forbidden to import from. */
const FORBIDDEN_FROM: Record<Tier, ReadonlySet<Tier>> = {
  apps: new Set<Tier>(),
  libs: new Set<Tier>(['apps']),
  pkgs: new Set<Tier>(['apps', 'libs']),
};

type ImportViolation = {
  kind: 'import';
  fromPkg: PackageName;
  fromTier: Tier;
  fromFile: string;
  targetScope: Tier;
  targetPkg: string;
};

type ManifestViolation = {
  kind: 'manifest';
  fromPkg: PackageName;
  fromTier: Tier;
  manifestPath: string;
  depKind: 'dependencies' | 'devDependencies';
  targetScope: Tier;
  targetPkg: string;
};

type Violation = ImportViolation | ManifestViolation;

function scanSourceImports(
  pkgName: PackageName,
  info: PackageInfo
): ImportViolation[] {
  const forbidden = FORBIDDEN_FROM[info.tier];
  if (forbidden.size === 0) return [];

  const violations: ImportViolation[] = [];
  const glob = new Glob('**/*.{ts,tsx,mts,cts}');
  for (const rel of glob.scanSync({ cwd: info.dir, absolute: false })) {
    if (rel.startsWith('node_modules/')) continue;
    if (rel.startsWith('dist/')) continue;
    if (rel.startsWith('.turbo/')) continue;

    const filePath = `${info.dir}/${rel}`;
    let source: string;
    try {
      source = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    source = stripTypeOnlyImports(stripComments(source));

    for (const match of source.matchAll(TIER_IMPORT_PATTERN)) {
      const targetTier = match[1] as Tier | undefined;
      const targetPkg = match[2];
      if (!targetTier || !targetPkg) continue;
      if (!forbidden.has(targetTier)) continue;
      violations.push({
        kind: 'import',
        fromPkg: pkgName,
        fromTier: info.tier,
        fromFile: relative(REPO_ROOT, filePath),
        targetScope: targetTier,
        targetPkg,
      });
    }
  }
  return violations;
}

type DepRecord = Record<string, string>;

function readManifest(
  manifestPath: string
): { dependencies?: DepRecord; devDependencies?: DepRecord } | null {
  try {
    const raw = readFileSync(manifestPath, 'utf8');
    return JSON.parse(raw) as ReturnType<typeof readManifest>;
  } catch {
    return null;
  }
}

function scanManifestDeps(
  pkgName: PackageName,
  info: PackageInfo
): ManifestViolation[] {
  const forbidden = FORBIDDEN_FROM[info.tier];
  if (forbidden.size === 0) return [];

  const manifestPath = `${info.dir}/package.json`;
  const manifest = readManifest(manifestPath);
  if (!manifest) return [];

  const out: ManifestViolation[] = [];
  for (const depKind of ['dependencies', 'devDependencies'] as const) {
    const block = manifest[depKind];
    if (!block) continue;
    for (const [depName] of Object.entries(block)) {
      const match = /^@(apps|libs|pkgs)\/([^/]+)$/.exec(depName);
      if (!match) continue;
      const targetTier = match[1] as Tier;
      const targetPkg = match[2]!;
      if (!forbidden.has(targetTier)) continue;
      out.push({
        kind: 'manifest',
        fromPkg: pkgName,
        fromTier: info.tier,
        manifestPath: relative(REPO_ROOT, manifestPath),
        depKind,
        targetScope: targetTier,
        targetPkg,
      });
    }
  }
  return out;
}

function describeImport(v: ImportViolation): string {
  return `  ${v.fromTier}/${v.fromPkg}: ${v.fromFile} -> @${v.targetScope}/${v.targetPkg}`;
}

function describeManifest(v: ManifestViolation): string {
  return `  ${v.fromTier}/${v.fromPkg}: ${v.manifestPath} (${v.depKind}) -> @${v.targetScope}/${v.targetPkg}`;
}

function main(): never {
  const packages = discoverPackagesWithTier();
  if (packages.size === 0) {
    console.error(
      `check:tier-imports: no @apps|@libs|@pkgs/* packages found under ${TIER_DIRS.join(', ')}.`
    );
    process.exit(1);
  }

  const importViolations: ImportViolation[] = [];
  const manifestViolations: ManifestViolation[] = [];
  for (const [name, info] of packages) {
    importViolations.push(...scanSourceImports(name, info));
    manifestViolations.push(...scanManifestDeps(name, info));
  }

  const total = importViolations.length + manifestViolations.length;
  if (total === 0) {
    console.log(
      `check:tier-imports OK -- ${packages.size} packages scanned, tier pyramid intact (apps -> libs -> pkgs).`
    );
    process.exit(0);
  }

  console.error(
    `check:tier-imports FAILED -- ${total} tier-boundary violation(s):\n`
  );
  if (importViolations.length > 0) {
    console.error(`Source imports (${importViolations.length}):`);
    for (const v of importViolations.sort((a, b) =>
      `${a.fromPkg}${a.fromFile}`.localeCompare(`${b.fromPkg}${b.fromFile}`)
    )) {
      console.error(describeImport(v));
    }
    console.error('');
  }
  if (manifestViolations.length > 0) {
    console.error(
      `package.json workspace deps (${manifestViolations.length}):`
    );
    for (const v of manifestViolations.sort((a, b) =>
      a.fromPkg.localeCompare(b.fromPkg)
    )) {
      console.error(describeManifest(v));
    }
    console.error('');
  }

  console.error('Tier import law:');
  console.error('  apps/  -> libs/, pkgs/   (apps compose anything)');
  console.error('  libs/  -> pkgs/ only     (no upward imports to apps)');
  console.error(
    '  pkgs/  -> pkgs/ only     (leaf tier: reusable, app-agnostic)'
  );
  console.error(
    'Fix by moving the package to the correct tier, or inverting the dependency.'
  );
  process.exit(1);
}

main();
