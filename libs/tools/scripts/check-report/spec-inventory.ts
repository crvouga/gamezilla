/**
 * What `specs/` holds, per bounded context, for the report's Specs section:
 * every feature with its scenario count, every Quint model, and which
 * packages run the domain against the harness (`specDomains`, gated in
 * `bun check` by their `test:spec:<k>` parts) or a deployment
 * (`liveDomains`, in `bun health`). Read statically, like `spec:check`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFeature } from '@pkgs/gherkin/parse';
import {
  domainFeaturePaths,
  domainModelPaths,
  REPO_ROOT,
  SPECS_DIR,
  specPackages,
} from '../spec-packages';

export type FeatureEntry = {
  readonly uri: string;
  readonly name: string;
  readonly scenarios: number;
};

export type DomainEntry = {
  readonly domain: string;
  readonly features: readonly FeatureEntry[];
  readonly models: readonly string[];
  /** Workspace names running the domain against the harness. */
  readonly harness: readonly string[];
  /** Workspace names running the domain against a deployment. */
  readonly live: readonly string[];
};

export type SpecInventory = readonly DomainEntry[];

function readFeature(uri: string): FeatureEntry {
  const feature = parseFeature(readFileSync(join(REPO_ROOT, uri), 'utf8'), uri);
  return { uri, name: feature.name, scenarios: feature.scenarios.length };
}

export function specInventory(): SpecInventory {
  const packages = specPackages();
  return readdirSync(join(REPO_ROOT, SPECS_DIR), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((domain) => ({
      domain,
      features: domainFeaturePaths(domain).map(readFeature),
      models: domainModelPaths(domain),
      harness: packages
        .filter((pkg) => pkg.specDomains.includes(domain))
        .map((pkg) => pkg.name),
      live: packages
        .filter((pkg) => pkg.liveDomains.includes(domain))
        .map((pkg) => pkg.name),
    }));
}
