/**
 * Discovery for the spec gates: every workspace package with a `features/`
 * directory, its parsed features, the step definitions its `tests/steps/**`
 * declare (read statically), and the step files of other packages its steps
 * entry imports. Shared with `check-specs.ts` and `spec-catalog.ts`.
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

function readFeatures(pkgDir: string): readonly SpecFeature[] {
  return listFiles(join(REPO_ROOT, pkgDir, 'features'), '.feature').map(
    (file) =>
      parseFeature(
        readFileSync(file, 'utf8'),
        relative(join(REPO_ROOT, pkgDir), file)
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

/** Every package with a `features/` directory, in path order. */
export function specPackages(): readonly SpecPackage[] {
  const dirs = packageDirs();
  const byName = new Map<string, string>();
  for (const dir of dirs) {
    const manifest = JSON.parse(
      readFileSync(join(REPO_ROOT, dir, 'package.json'), 'utf8')
    ) as Manifest;
    if (manifest.name !== undefined) byName.set(manifest.name, dir);
  }
  const out: SpecPackage[] = [];
  for (const dir of dirs) {
    if (!existsSync(join(REPO_ROOT, dir, 'features'))) continue;
    const manifest = JSON.parse(
      readFileSync(join(REPO_ROOT, dir, 'package.json'), 'utf8')
    ) as Manifest;
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
      problems.push(`${dir}: has features/ but no tests/steps/index.ts`);
    }
    out.push({
      name,
      dir,
      domain: dir.replace(/^.*\//, ''),
      features: readFeatures(dir),
      definitions: own.steps,
      imports,
      stepsEntry,
      problems,
    });
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
 * Definitions in step files some package imports from a package that has no
 * `features/` of its own (so it is not a spec package), e.g. profile's steps
 * reused by friends before profile has features.
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
