#!/usr/bin/env bun
// @io-wall-ok — tools composition root

/**
 * Fail-fast guardrail: enforce the workspace tier import pyramid.
 *
 *   test -> apps, libs, pkgs  (system tests / DST)
 *   apps -> apps, libs, pkgs  (never @test/*; cross-app OK e.g. client → api)
 *   libs -> pkgs only    (libs may not import apps or test)
 *   pkgs -> pkgs only    (pkgs is the leaf; no upward imports)
 *
 * Why a custom script (not `dependency-cruiser` alone): depcruise's
 * `doNotFollow.path: 'node_modules'` skips workspace symlinks, so cross-package
 * `@apps|@libs|@pkgs/<name>` imports are never traversed (bun resolves
 * workspace packages through node_modules symlinks). Same reason
 * `tools/scripts/check-circular-deps.ts` exists.
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
  discoverPackagesWithTier,
  type PackageInfo,
  type PackageName,
  REPO_ROOT,
  stripComments,
  stripTypeOnlyImports,
  TIER_DIRS,
  TIER_IMPORT_PATTERN,
  type Tier,
} from './workspace-package-import-graph';

/** Tiers that the key tier is forbidden to import from. */
const FORBIDDEN_FROM: Record<Tier, ReadonlySet<Tier>> = {
  test: new Set<Tier>(),
  apps: new Set<Tier>(['test']),
  libs: new Set<Tier>(['apps', 'test']),
  pkgs: new Set<Tier>(['apps', 'libs', 'test']),
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

/** True when the import/dep edge breaks the tier pyramid. */
function isForbiddenEdge(
  fromTier: Tier,
  _fromScoped: PackageName,
  targetTier: Tier,
  _targetShort: string
): boolean {
  return FORBIDDEN_FROM[fromTier].has(targetTier);
}

function scanSourceImports(
  pkgName: PackageName,
  info: PackageInfo
): ImportViolation[] {
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
      if (!isForbiddenEdge(info.tier, pkgName, targetTier, targetPkg)) continue;
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
  const manifestPath = `${info.dir}/package.json`;
  const manifest = readManifest(manifestPath);
  if (!manifest) return [];

  const out: ManifestViolation[] = [];
  for (const depKind of ['dependencies', 'devDependencies'] as const) {
    const block = manifest[depKind];
    if (!block) continue;
    for (const [depName] of Object.entries(block)) {
      const match = /^@(apps|libs|pkgs|test)\/([^/]+)$/.exec(depName);
      if (!match) continue;
      const targetTier = match[1] as Tier;
      const targetPkg = match[2]!;
      if (!isForbiddenEdge(info.tier, pkgName, targetTier, targetPkg)) continue;
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
  return `  ${v.fromPkg}: ${v.fromFile} -> @${v.targetScope}/${v.targetPkg}`;
}

function describeManifest(v: ManifestViolation): string {
  return `  ${v.fromPkg}: ${v.manifestPath} (${v.depKind}) -> @${v.targetScope}/${v.targetPkg}`;
}

function main(): never {
  const packages = discoverPackagesWithTier();
  if (packages.size === 0) {
    console.error(
      `check:tier-imports: no @apps|@libs|@pkgs|@test/* packages found under ${TIER_DIRS.join(', ')}.`
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
      `check:tier-imports OK -- ${packages.size} packages scanned, tier pyramid intact (test -> apps -> libs -> pkgs; apps may compose apps).`
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
  console.error('  test/  -> apps/, libs/, pkgs/  (system tests / DST)');
  console.error(
    '  apps/  -> libs/, pkgs/   (never other @apps/*; never @test/*)'
  );
  console.error('  libs/  -> pkgs/ only     (no upward imports to apps/test)');
  console.error(
    '  pkgs/  -> pkgs/ only     (leaf tier: reusable, app-agnostic)'
  );
  console.error(
    'Fix by moving the package to the correct tier, or inverting the dependency.'
  );
  process.exit(1);
}

main();
