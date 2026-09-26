#!/usr/bin/env bun
// @io-wall-ok — CLI entry (`bun run spec:catalog`).
/**
 * Step catalogs: `<package>/STEPS_CATALOG.md` for every package with
 * `features/`, plus the root index `docs/STEPS_CATALOG.md`. Generated from
 * `tests/steps/**` so spec writers read wording without reading `tests/`.
 * `check-specs.ts` fails on drift; `bun run spec:catalog` rewrites.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  renderCatalogIndex,
  renderPackageCatalog,
} from '@pkgs/gherkin/catalog';
import type { ExtractedStep } from '@pkgs/gherkin/extract';
import {
  importedSteps,
  REPO_ROOT,
  type SpecPackage,
  sharedSteps,
  specPackages,
} from './spec-packages';

export const PACKAGE_CATALOG = 'STEPS_CATALOG.md';
export const INDEX_CATALOG = 'docs/STEPS_CATALOG.md';

type Rendered = { readonly path: string; readonly content: string };

export function renderCatalogs(
  packages: readonly SpecPackage[],
  shared: readonly ExtractedStep[]
): readonly Rendered[] {
  const out: Rendered[] = packages.map((pkg) => ({
    path: `${pkg.dir}/${PACKAGE_CATALOG}`,
    content: renderPackageCatalog(pkg, shared, importedSteps(pkg, packages)),
  }));
  out.push({
    path: INDEX_CATALOG,
    content: renderCatalogIndex(
      packages,
      (pkg) => `../${pkg.dir}/${PACKAGE_CATALOG}`
    ),
  });
  return out;
}

/** Catalog files missing or different from what the sources render. */
export function catalogDrift(
  packages: readonly SpecPackage[],
  shared: readonly ExtractedStep[]
): readonly string[] {
  const out: string[] = [];
  for (const file of renderCatalogs(packages, shared)) {
    const full = join(REPO_ROOT, file.path);
    const current = existsSync(full) ? readFileSync(full, 'utf8') : null;
    if (current !== file.content) {
      out.push(
        `${file.path} is ${current === null ? 'missing' : 'stale'} — run \`bun run spec:catalog\``
      );
    }
  }
  return out;
}

if (import.meta.main) {
  const packages = specPackages();
  const shared = sharedSteps();
  for (const file of renderCatalogs(packages, shared.steps)) {
    writeFileSync(join(REPO_ROOT, file.path), file.content);
    console.log(`wrote ${file.path}`);
  }
}
