#!/usr/bin/env bun
// @io-wall-ok — CLI entry (`bun run spec:catalog`).
/**
 * Step catalogs: `<package>/STEPS_CATALOG.md` for every package that runs
 * spec domains (`specDomains`), plus the root index `docs/STEPS_CATALOG.md`. Generated from
 * `tests/steps/**` so spec writers read wording without reading `tests/`.
 * They are gitignored build output, never committed, so concurrent worktrees
 * adding steps never conflict on them: `bun install` writes them
 * (`postinstall`) and `bun run spec:catalog` rewrites them after a step change.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  renderCatalogIndex,
  renderPackageCatalog,
} from '@pkgs/gherkin-shared/catalog';
import type { ExtractedStep } from '@pkgs/gherkin-shared/extract';
import type { SpecPackage } from './spec-packages';
import {
  importedSteps,
  REPO_ROOT,
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

if (import.meta.main) {
  const packages = specPackages();
  const shared = sharedSteps();
  const files = renderCatalogs(packages, shared.steps);
  for (const file of files) {
    const full = join(REPO_ROOT, file.path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, file.content);
  }
  console.log(`spec:catalog: wrote ${String(files.length)} step catalogs`);
}
