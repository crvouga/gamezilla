/**
 * Discovery for the spec gates. Every spec lives in the flat top-level tree
 * `specs/<domain>/` — Gherkin features (`<feature>.feature`) and Quint models
 * (`<model>.qnt`); a workspace package runs the domains its `package.json`
 * lists in `specDomains` (against the sim, in its `test:e2e`) and in
 * `liveDomains` (against a deployed environment, in its `health`). For each
 * such package: its parsed features, the step definitions its `tests/steps/**`
 * declare (read statically), the step files of other packages its steps entry
 * imports, and its models with the bindings its `tests/quint/**` declare.
 * Shared with `check-specs.ts`, `spec-catalog.ts` and `spec-run.ts`.
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
/** The specifier prefix a steps entry registers the shared steps with. */
const SHARED_STEPS_IMPORT = '@libs/sim-harness/spec/steps/';
const TIERS = ['apps', 'libs', 'pkgs'] as const;

export type SpecPackage = PackageSpecs & {
  /** Repo-relative package directory. */
  readonly dir: string;
  /** Domains run against the sim (`test:e2e`). */
  readonly specDomains: readonly string[];
  /** Domains run against a deployed environment (`health`). */
  readonly liveDomains: readonly string[];
  /** Repo-relative `tests/steps/index.ts`, or null when missing. */
  readonly stepsEntry: string | null;
  /** Repo-relative paths of the Quint models in this package's domains. */
  readonly models: readonly string[];
  readonly problems: readonly string[];
};

type Manifest = {
  readonly name?: string;
  readonly exports?: Record<string, unknown>;
  /** The `specs/<domain>/` directories this package runs against the sim. */
  readonly specDomains?: readonly string[];
  /** The `specs/<domain>/` directories this package runs against a deployment. */
  readonly liveDomains?: readonly string[];
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

/** The shared harness definitions, seen by packages whose steps entry imports them. */
export function sharedSteps(): {
  readonly steps: readonly ExtractedStep[];
  readonly problems: readonly string[];
} {
  return readSteps(stepFiles(SHARED_STEPS_DIR));
}

function domainSpecPaths(domain: string, suffix: string): readonly string[] {
  const dir = join(REPO_ROOT, SPECS_DIR, domain);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry) => `${SPECS_DIR}/${domain}/${entry.name}`)
    .sort();
}

/** Repo-relative paths of the features in `specs/<domain>/`, flat. */
export function domainFeaturePaths(domain: string): readonly string[] {
  return domainSpecPaths(domain, '.feature');
}

/**
 * Repo-relative paths of the Quint models in `specs/<domain>/`, flat. A
 * context's `events.qnt` is its published language — types other contexts
 * import — not a model, so it is never run.
 */
export function domainModelPaths(domain: string): readonly string[] {
  return domainSpecPaths(domain, '.qnt').filter(
    (path) => !path.endsWith('/events.qnt')
  );
}

const MODEL_BINDING = /\bmodel:\s*['"]([a-z0-9-]+)['"]/g;

/**
 * Every model has exactly one binding in the package's `tests/quint/**`, and
 * every binding names a model of the package's domains or a package-local
 * model beside it (`tests/quint/<stem>.qnt`) — read statically
 * (`bindQuintModel({ model: '<stem>', … })`), like the step files.
 */
function modelProblems(
  dir: string,
  models: readonly string[]
): readonly string[] {
  const problems: string[] = [];
  const quintDir = `${dir}/tests/quint`;
  const bindings = new Map<string, string[]>();
  for (const file of listFiles(join(REPO_ROOT, quintDir), '.ts')) {
    const rel = relative(REPO_ROOT, file);
    for (const match of readFileSync(file, 'utf8').matchAll(MODEL_BINDING)) {
      const model = match[1] ?? '';
      bindings.set(model, [...(bindings.get(model) ?? []), rel]);
    }
  }
  if (models.length > 0 && !existsSync(join(REPO_ROOT, quintDir, 'index.ts'))) {
    problems.push(
      `${dir}: runs Quint models but has no tests/quint/index.ts (it imports the bindings and calls useQuintSim)`
    );
  }
  const stems = new Set(
    models.map((path) => path.replace(/^.*\//, '').replace(/\.qnt$/, ''))
  );
  for (const path of models) {
    const stem = path.replace(/^.*\//, '').replace(/\.qnt$/, '');
    const files = bindings.get(stem) ?? [];
    if (files.length === 0) {
      problems.push(
        `${path}: no binding — add bindQuintModel({ model: '${stem}', … }) under ${quintDir}/`
      );
    } else if (files.length > 1) {
      problems.push(`${path}: bound more than once (${files.join(', ')})`);
    }
  }
  for (const [model, files] of bindings) {
    // A package-local model (internal invariants, run from the package's own
    // `test` via `runQuintModel`) sits beside its binding in `tests/quint/`.
    if (existsSync(join(REPO_ROOT, quintDir, `${model}.qnt`))) continue;
    if (!stems.has(model)) {
      problems.push(
        `${files.join(', ')}: binds model "${model}", which is not a specs/<domain>/${model}.qnt of this package's specDomains`
      );
    }
  }
  return problems;
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

/** Every package that runs spec domains (`specDomains` / `liveDomains`), in path order. */
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
    const specDomains = manifest.specDomains ?? [];
    const liveDomains = manifest.liveDomains ?? [];
    const domains = [...new Set([...specDomains, ...liveDomains])];
    if (domains.length === 0) continue;
    const name = manifest.name ?? dir;
    const entryPath = `${dir}/tests/steps/index.ts`;
    const stepsEntry = existsSync(join(REPO_ROOT, entryPath))
      ? entryPath
      : null;
    const own = readSteps(stepFiles(`${dir}/tests/steps`));
    const models = domains.flatMap(domainModelPaths);
    const problems = [...own.problems, ...modelProblems(dir, models)];
    const imports: string[] = [];
    let sharedSteps = false;
    if (stepsEntry !== null) {
      for (const specifier of extractStepImports(
        readFileSync(join(REPO_ROOT, stepsEntry), 'utf8')
      )) {
        if (specifier.startsWith(SHARED_STEPS_IMPORT)) sharedSteps = true;
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
      problems.push(
        `${dir}: runs spec domains but has no tests/steps/index.ts`
      );
    }
    out.push({
      name,
      dir,
      domains,
      specDomains,
      liveDomains,
      features: readFeatures(domains),
      definitions: own.steps,
      imports,
      sharedSteps,
      stepsEntry,
      models,
      problems,
    });
  }
  return out;
}

function runnersBy(
  packages: readonly SpecPackage[],
  domainsOf: (pkg: SpecPackage) => readonly string[]
): Map<string, string[]> {
  const runners = new Map<string, string[]>();
  for (const pkg of packages) {
    for (const domain of domainsOf(pkg)) {
      runners.set(domain, [...(runners.get(domain) ?? []), pkg.name]);
    }
  }
  return runners;
}

/**
 * The `specs/` tree is flat and fully owned: the shared kernel's
 * `specs/ubiquitous-language.yml`, and in each bounded context only its
 * `ubiquitous-language.yml`, `*.feature` and `*.qnt`; every domain directory run by some package — by
 * at most one against the sim (`specDomains`) and at most one live
 * (`liveDomains`) — every claimed domain present, and no package keeping a
 * `features/` directory of its own.
 */
export function specsLayoutProblems(
  packages: readonly SpecPackage[]
): readonly string[] {
  const out: string[] = [];
  const root = join(REPO_ROOT, SPECS_DIR);
  const runners = runnersBy(packages, (pkg) => pkg.domains);
  const simRunners = runnersBy(packages, (pkg) => pkg.specDomains);
  const liveRunners = runnersBy(packages, (pkg) => pkg.liveDomains);
  const present = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
    : [];
  for (const entry of present) {
    const path = `${SPECS_DIR}/${entry.name}`;
    if (!entry.isDirectory()) {
      if (entry.name !== 'ubiquitous-language.yml') {
        out.push(
          `${path}: only specs/<domain>/ directories and the shared kernel's specs/ubiquitous-language.yml belong in specs/`
        );
      }
      continue;
    }
    for (const inner of readdirSync(join(root, entry.name), {
      withFileTypes: true,
    })) {
      if (
        !inner.isFile() ||
        !(
          inner.name.endsWith('.feature') ||
          inner.name.endsWith('.qnt') ||
          inner.name === 'ubiquitous-language.yml'
        )
      ) {
        out.push(
          `${path}/${inner.name}: specs/ is flat — only specs/<domain>/ubiquitous-language.yml, <feature>.feature and <model>.qnt`
        );
      }
    }
    if ((runners.get(entry.name) ?? []).length === 0) {
      out.push(
        `${path}/: no package lists "${entry.name}" in its package.json specDomains or liveDomains`
      );
    }
    for (const [field, byDomain] of [
      ['specDomains', simRunners],
      ['liveDomains', liveRunners],
    ] as const) {
      const owners = byDomain.get(entry.name) ?? [];
      if (owners.length > 1) {
        out.push(
          `${path}/: run by several packages' ${field} (${owners.join(', ')})`
        );
      }
    }
  }
  const names = new Set(
    present.filter((e) => e.isDirectory()).map((e) => e.name)
  );
  for (const [domain, owners] of runners) {
    if (!names.has(domain)) {
      out.push(
        `${owners.join(', ')}: lists "${domain}" but ${SPECS_DIR}/${domain}/ does not exist`
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
    for (const domain of pkg.specDomains) {
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
