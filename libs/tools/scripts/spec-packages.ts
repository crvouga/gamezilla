/**
 * Discovery for the spec gates. Every feature lives in the flat top-level
 * tree `specs/<domain>/<feature>.feature`; a workspace package runs the
 * domains its `package.json` lists in `specDomains`. For each such package:
 * its parsed features, the step definitions its `tests/steps/**` declare
 * (read statically), and the step files of other packages its steps entry
 * imports. Shared with `check-specs.ts`, `spec-catalog.ts` and `spec-run.ts`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { PackageSpecs } from '@pkgs/gherkin/check';
import {
  type ExtractedStep,
  extractStepImports,
  extractSteps,
} from '@pkgs/gherkin/extract';
import { parseFeature, type SpecFeature } from '@pkgs/gherkin/parse';

export const REPO_ROOT = resolve(import.meta.dir, '../../..');
export const SHARED_STEPS_DIR = 'libs/sim-harness/src/spec/steps';
export const SPECS_DIR = 'specs';
const TIERS = ['apps', 'libs', 'pkgs'] as const;

export type SpecPackage = PackageSpecs & {
  /** Repo-relative package directory. */
  readonly dir: string;
  /** Repo-relative `tests/steps/index.ts`, or null when missing. */
  readonly stepsEntry: string | null;
  readonly problems: readonly string[];
};

type Manifest = {
  readonly name?: string;
  readonly exports?: Record<string, unknown>;
  /** The `specs/<domain>/` directories this package runs. */
  readonly specDomains?: readonly string[];
};

function listFiles(dir: string, suffix: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') listFiles(full, suffix, out);
    } else if (entry.name.endsWith(suffix)) {
      out.push(full);
    }
  }
  return out;
}

/** Repo-relative paths of every step file under `dir` (recursive). */
function stepFiles(dir: string): readonly string[] {
  return listFiles(join(REPO_ROOT, dir), '.ts')
    .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('/index.ts'))
    .map((file) => relative(REPO_ROOT, file));
}

function readSteps(files: readonly string[]): {
  readonly steps: ExtractedStep[];
  readonly problems: string[];
} {
  const steps: ExtractedStep[] = [];
  const problems: string[] = [];
  for (const file of files) {
    const extracted = extractSteps(
      readFileSync(join(REPO_ROOT, file), 'utf8'),
      file
    );
    steps.push(...extracted.steps);
    problems.push(...extracted.problems);
  }
  return { steps, problems };
}

/** The shared harness definitions every package sees. */
export function sharedSteps(): {
  readonly steps: readonly ExtractedStep[];
  readonly problems: readonly string[];
} {
  return readSteps(stepFiles(SHARED_STEPS_DIR));
}

/** Repo-relative paths of the features in `specs/<domain>/`, flat. */
export function domainFeaturePaths(domain: string): readonly string[] {
  const dir = join(REPO_ROOT, SPECS_DIR, domain);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.feature'))
    .map((entry) => `${SPECS_DIR}/${domain}/${entry.name}`)
    .sort();
}

function readFeatures(domains: readonly string[]): readonly SpecFeature[] {
  return domains.flatMap((domain) =>
    domainFeaturePaths(domain).map((uri) =>
      parseFeature(readFileSync(join(REPO_ROOT, uri), 'utf8'), uri)
    )
  );
}

/**
 * `@libs/profile/steps/profile.steps` → `libs/profile/tests/steps/profile.steps.ts`,
 * via that package's `./steps/*` export. Anything else is not a step import.
 */
function resolveStepImport(
  specifier: string,
  byName: ReadonlyMap<string, string>
): string | null {
  const match = /^(@[a-z]+\/[a-z0-9-]+)\/steps\/(.+)$/.exec(specifier);
  if (match === null) return null;
  const dir = byName.get(match[1] ?? '');
  if (dir === undefined) return null;
  return `${dir}/tests/steps/${match[2] ?? ''}.ts`;
}

function packageDirs(): readonly string[] {
  const out: string[] = [];
  for (const tier of TIERS) {
    const tierDir = join(REPO_ROOT, tier);
    if (!existsSync(tierDir)) continue;
    for (const entry of readdirSync(tierDir, { withFileTypes: true })) {
      if (
        entry.isDirectory() &&
        existsSync(join(tierDir, entry.name, 'package.json'))
      ) {
        out.push(`${tier}/${entry.name}`);
      }
    }
  }
  return out.sort();
}

function readManifest(dir: string): Manifest {
  return JSON.parse(
    readFileSync(join(REPO_ROOT, dir, 'package.json'), 'utf8')
  ) as Manifest;
}

/** Every package that runs spec domains (`specDomains`), in path order. */
export function specPackages(): readonly SpecPackage[] {
  const dirs = packageDirs();
  const byName = new Map<string, string>();
  for (const dir of dirs) {
    const manifest = readManifest(dir);
    if (manifest.name !== undefined) byName.set(manifest.name, dir);
  }
  const out: SpecPackage[] = [];
  for (const dir of dirs) {
    const manifest = readManifest(dir);
    const domains = manifest.specDomains ?? [];
    if (domains.length === 0) continue;
    const name = manifest.name ?? dir;
    const entryPath = `${dir}/tests/steps/index.ts`;
    const stepsEntry = existsSync(join(REPO_ROOT, entryPath))
      ? entryPath
      : null;
    const own = readSteps(stepFiles(`${dir}/tests/steps`));
    const problems = [...own.problems];
    const imports: string[] = [];
    if (stepsEntry !== null) {
      for (const specifier of extractStepImports(
        readFileSync(join(REPO_ROOT, stepsEntry), 'utf8')
      )) {
        const file = resolveStepImport(specifier, byName);
        if (file === null) continue;
        if (!existsSync(join(REPO_ROOT, file))) {
          problems.push(
            `${stepsEntry}: imports ${specifier} but ${file} does not exist`
          );
          continue;
        }
        imports.push(file);
      }
    } else {
      problems.push(`${dir}: runs specDomains but has no tests/steps/index.ts`);
    }
    out.push({
      name,
      dir,
      domains,
      features: readFeatures(domains),
      definitions: own.steps,
      imports,
      stepsEntry,
      problems,
    });
  }
  return out;
}

/**
 * The `specs/` tree is flat and fully owned: only `specs/<domain>/*.feature`,
 * every domain directory run by exactly one package, every claimed domain
 * present, and no package keeping a `features/` directory of its own.
 */
export function specsLayoutProblems(
  packages: readonly SpecPackage[]
): readonly string[] {
  const out: string[] = [];
  const root = join(REPO_ROOT, SPECS_DIR);
  const runners = new Map<string, string[]>();
  for (const pkg of packages) {
    for (const domain of pkg.domains) {
      runners.set(domain, [...(runners.get(domain) ?? []), pkg.name]);
    }
  }
  const present = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
    : [];
  for (const entry of present) {
    const path = `${SPECS_DIR}/${entry.name}`;
    if (!entry.isDirectory()) {
      out.push(`${path}: only specs/<domain>/ directories belong in specs/`);
      continue;
    }
    for (const inner of readdirSync(join(root, entry.name), {
      withFileTypes: true,
    })) {
      if (!inner.isFile() || !inner.name.endsWith('.feature')) {
        out.push(
          `${path}/${inner.name}: specs/ is flat — only specs/<domain>/<feature>.feature`
        );
      }
    }
    const owners = runners.get(entry.name) ?? [];
    if (owners.length === 0) {
      out.push(
        `${path}/: no package lists "${entry.name}" in its package.json specDomains`
      );
    } else if (owners.length > 1) {
      out.push(`${path}/: run by several packages (${owners.join(', ')})`);
    }
  }
  const names = new Set(
    present.filter((e) => e.isDirectory()).map((e) => e.name)
  );
  for (const [domain, owners] of runners) {
    if (!names.has(domain)) {
      out.push(
        `${owners.join(', ')}: specDomains lists "${domain}" but ${SPECS_DIR}/${domain}/ does not exist`
      );
    }
  }
  for (const pkg of packages) {
    const turbo = join(REPO_ROOT, pkg.dir, 'turbo.json');
    const inputs = existsSync(turbo)
      ? ((
          JSON.parse(readFileSync(turbo, 'utf8')) as {
            readonly tasks?: Record<string, { readonly inputs?: string[] }>;
          }
        ).tasks?.['test:e2e']?.inputs ?? [])
      : [];
    for (const domain of pkg.domains) {
      const input = `$TURBO_ROOT$/${SPECS_DIR}/${domain}/**`;
      if (!inputs.includes(input)) {
        out.push(
          `${pkg.dir}/turbo.json: test:e2e inputs must include "${input}" so a spec change re-runs ${pkg.name}`
        );
      }
    }
  }
  for (const dir of packageDirs()) {
    if (existsSync(join(REPO_ROOT, dir, 'features'))) {
      out.push(
        `${dir}/features: features live in ${SPECS_DIR}/<domain>/ — move them and list the domain in specDomains`
      );
    }
  }
  return out;
}

/** Definitions of the files a package imports, grouped by owner package name. */
export function importedSteps(
  pkg: SpecPackage,
  all: readonly SpecPackage[]
): ReadonlyMap<string, readonly ExtractedStep[]> {
  const out = new Map<string, readonly ExtractedStep[]>();
  for (const owner of all) {
    const steps = owner.definitions.filter((step) =>
      pkg.imports.includes(step.file)
    );
    if (steps.length > 0) out.set(owner.name, steps);
  }
  return out;
}

/**
 * Definitions in step files some package imports from a package that runs
 * no spec domains (so it is not a spec package), e.g. profile's steps reused
 * by friends before profile had specs.
 */
export function externalSteps(packages: readonly SpecPackage[]): {
  readonly steps: readonly ExtractedStep[];
  readonly problems: readonly string[];
} {
  const owned = new Set(
    packages.flatMap((pkg) => pkg.definitions.map((d) => d.file))
  );
  const files = [...new Set(packages.flatMap((pkg) => pkg.imports))]
    .filter((file) => !owned.has(file))
    .sort();
  return readSteps(files);
}
