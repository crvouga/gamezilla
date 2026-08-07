#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
/**
 * Enforce Bun workspace dependency policy: every third-party version in
 * package.json must come from the root catalog (`catalog:` / `catalog:name`)
 * or from the workspace protocol (`workspace:*`). Literal semver (or file:/link:)
 * in dependencies / devDependencies / peerDependencies / optionalDependencies
 * is forbidden so the root `catalog` stays the single source of truth.
 *
 * Skips: root `catalog` / `catalogs` values (they hold the real ranges) and
 * root `overrides` (Bun/npm resolution pins, not catalog entries).
 */
import { Glob } from 'bun';

const REPO_ROOT = join(import.meta.dirname, '../..');

const DEP_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

function isAllowedVersionRange(range: string): boolean {
  return range.startsWith('workspace:') || range.startsWith('catalog:');
}

type Violation = { file: string; section: string; dep: string; range: string };

function scanPackageJson(absPath: string): Violation[] {
  const out: Violation[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(absPath, 'utf8')) as unknown;
  } catch (e) {
    console.error(
      `catalog-deps: invalid JSON: ${relative(REPO_ROOT, absPath)}`,
      e
    );
    process.exit(1);
  }
  if (raw === null || typeof raw !== 'object') return out;
  const pkg = raw as Record<string, unknown>;

  for (const section of DEP_SECTIONS) {
    const block = pkg[section];
    if (block === undefined) continue;
    if (block === null || typeof block !== 'object') {
      out.push({
        file: relative(REPO_ROOT, absPath),
        section,
        dep: '(invalid block)',
        range: String(block),
      });
      continue;
    }
    for (const [dep, range] of Object.entries(
      block as Record<string, unknown>
    )) {
      if (typeof range !== 'string') {
        out.push({
          file: relative(REPO_ROOT, absPath),
          section,
          dep,
          range: `(non-string: ${typeof range})`,
        });
        continue;
      }
      if (!isAllowedVersionRange(range)) {
        out.push({ file: relative(REPO_ROOT, absPath), section, dep, range });
      }
    }
  }

  return out;
}

function discoverPackageJsonPaths(): string[] {
  const paths = [join(REPO_ROOT, 'package.json')];
  for (const tier of ['apps', 'libs', 'pkgs'] as const) {
    const glob = new Glob(`${tier}/*/package.json`);
    for (const rel of glob.scanSync({ cwd: REPO_ROOT, absolute: false })) {
      paths.push(join(REPO_ROOT, rel));
    }
  }
  return paths;
}

function main(): void {
  const violations: Violation[] = [];
  const paths = discoverPackageJsonPaths();
  for (const abs of paths) {
    violations.push(...scanPackageJson(abs));
  }

  if (violations.length > 0) {
    console.error(
      'check:catalog-deps FAILED — use root `catalog` + `catalog:` (or `workspace:*`) only:\n'
    );
    for (const v of violations) {
      console.error(
        `  ${v.file} → ${v.section}["${v.dep}"] = ${JSON.stringify(v.range)}`
      );
    }
    console.error(
      '\nFix: add the package to root `package.json` → `catalog`, then set this entry to "catalog:" (or "catalog:<name>").'
    );
    process.exit(1);
  }

  console.log(
    `check:catalog-deps OK — ${paths.length} package.json file(s), only catalog:/workspace: version ranges.`
  );
}

main();
