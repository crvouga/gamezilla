/**
 * `@synthetic` features and `# live` objectives run against a deployment,
 * from the package that has `liveDomains`, not on the harness — wherever
 * the file sits. See specs/README.md (live checks).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFeature } from '@pkgs/gherkin-shared/parse';
import type { SpecFeature } from '@pkgs/gherkin-shared/parse';
import { SYNTHETIC_TAG } from '@pkgs/gherkin-shared/tags';
import { isLiveObjectiveSource } from '@pkgs/openslo-shared/live';

const REPO_ROOT = resolve(import.meta.dir, '../../..');
const SPECS_DIR = join(REPO_ROOT, 'specs');

function specDirs(): readonly string[] {
  return readdirSync(SPECS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function filesEnding(suffix: string): readonly string[] {
  return specDirs().flatMap((domain) => {
    const dir = join(SPECS_DIR, domain);
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
      .map((entry) => `specs/${domain}/${entry.name}`)
      .sort();
  });
}

/** Every feature whose feature line is `@synthetic`. */
export function syntheticFeatures(): readonly SpecFeature[] {
  return filesEnding('.feature').flatMap((uri) => {
    const feature = parseFeature(
      readFileSync(join(REPO_ROOT, uri), 'utf8'),
      uri
    );
    return feature.tags.includes(SYNTHETIC_TAG) ? [feature] : [];
  });
}

/** Every objective file marked `# live` (repo-relative). */
export function liveObjectivePaths(): readonly string[] {
  return filesEnding('.openslo.yaml').filter((uri) =>
    isLiveObjectiveSource(readFileSync(join(REPO_ROOT, uri), 'utf8'))
  );
}

/** Harness features: drop `@synthetic`. A live package also runs those. */
export function featuresFor(
  domainFeatures: readonly SpecFeature[],
  synthetic: readonly SpecFeature[],
  live: boolean
): readonly SpecFeature[] {
  const base = domainFeatures.filter(
    (feature) => !feature.tags.includes(SYNTHETIC_TAG)
  );
  if (!live) return base;
  const seen = new Set(base.map((feature) => feature.uri));
  return [...base, ...synthetic.filter((feature) => !seen.has(feature.uri))];
}

/** Harness objectives drop `# live` files. A live package runs those. */
export function objectivesFor(
  domainObjectives: readonly string[],
  liveObjectives: readonly string[],
  live: boolean
): readonly string[] {
  const dropped = new Set(liveObjectives);
  const base = domainObjectives.filter((path) => !dropped.has(path));
  if (!live) return base;
  const seen = new Set(base);
  return [...base, ...liveObjectives.filter((path) => !seen.has(path))];
}
