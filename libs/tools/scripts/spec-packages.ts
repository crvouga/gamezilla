/**
 * Discovery for the spec gates. Every spec lives in the flat top-level tree
 * `specs/<domain>/` — Gherkin features (`<feature>.feature`), Quint models
 * (`<model>.qnt`), DMN decision tables (`.dmn`), Alloy structures (`.als`)
 * and OpenSLO objectives (`.openslo.yaml`, see `spec-kinds.ts`); a workspace
 * package runs the domains its `package.json`
 * lists in `specDomains` (against the harness, in its `test:spec`) and in
 * `liveDomains` (against a deployed environment, in its `health`). For each
 * such package: its parsed features, the step definitions its `tests/steps/**`
 * declare (read statically), the step files of other packages its steps entry
 * imports, its models with the bindings its `tests/quint/**` declare, and its
 * decision tables, structures and objectives with their `tests/<kind>/**`
 * bindings. The harness runner (`test-spec.ts`) runs every kind in
 * `specDomains`; a live run (`health`) runs features and objectives in
 * `liveDomains`, plus every `@synthetic` feature and every `# live`
 * objective, so a live package binds those wherever they sit.
 * Shared with `check-specs.ts`, `spec-catalog.ts` and `spec-run.ts`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { PackageSpecs } from '@pkgs/gherkin-shared/check';
import type { ExtractedStep } from '@pkgs/gherkin-shared/extract';
import { extractStepImports, extractSteps } from '@pkgs/gherkin-shared/extract';
import type { SpecFeature } from '@pkgs/gherkin-shared/parse';
import { parseFeature } from '@pkgs/gherkin-shared/parse';
import { campaignOwnershipProblems, specCampaigns } from './spec-campaigns';
import type { BindingKind } from './spec-kinds';
import {
  BINDING_KINDS,
  bindingProblems,
  contextEntryProblem,
  specsRootEntryProblem,
} from './spec-kinds';
import {
  featuresFor,
  liveObjectivePaths,
  objectivesFor,
  syntheticFeatures,
} from './spec-live';

export const REPO_ROOT = resolve(import.meta.dir, '../../..');
export const SHARED_STEPS_DIR = 'libs/harness/src';
export const SPECS_DIR = 'specs';
/** The specifier prefix a steps entry registers the shared steps with. */
const SHARED_STEPS_IMPORT = '@libs/harness/platform';
const TIERS = ['apps', 'libs', 'pkgs'] as const;
/** The spec runner every `test:spec` and `test:spec:<k>` script calls. */
const SPEC_RUNNER = 'bun run ../../libs/harness/scripts/test-spec.ts';
/** The Quint models check (`check:models`) of every package with models. */
export const MODELS_RUNNER = 'bun run ../../libs/tools/scripts/check-models.ts';
/**
 * Most parts one suite may split into: root `turbo.json` defines
 * `test:spec:0` … `test:spec:<MAX_SPEC_PARTS - 1>` and `//#check` runs them.
 */
export const MAX_SPEC_PARTS = 64;

export type SpecPackage = PackageSpecs & {
  /** Repo-relative package directory. */
  readonly dir: string;
  /** Domains run against the harness (`test:spec`). */
  readonly specDomains: readonly string[];
  /** Domains run against a deployed environment (`health`). */
  readonly liveDomains: readonly string[];
  /** Repo-relative `tests/steps/index.ts`, or null when missing. */
  readonly stepsEntry: string | null;
  /** Repo-relative paths of the Quint models in this package's domains. */
  readonly models: readonly string[];
  /** Repo-relative `.dmn` decision tables this package runs (`specDomains`). */
  readonly decisions: readonly string[];
  /** Repo-relative `.als` structures this package runs (`specDomains`). */
  readonly structures: readonly string[];
  /**
   * Repo-relative `.openslo.yaml` objectives this package runs: its domains,
   * plus every `# live` objective when it has live domains.
   */
  readonly objectives: readonly string[];
  readonly problems: readonly string[];
};

type Manifest = {
  readonly name?: string;
  readonly exports?: Record<string, unknown>;
  /** The `specs/<domain>/` directories this package runs against the harness. */
  readonly specDomains?: readonly string[];
  /** The `specs/<domain>/` directories this package runs against a deployment. */
  readonly liveDomains?: readonly string[];
  /** How many `test:spec:<k>` parts `bun check` splits the suite into. */
  readonly specParts?: number;
  readonly scripts?: Readonly<Record<string, string>>;
};

/**
 * What is wrong with how a package splits its spec suite for `bun check`:
 * `test:spec:<k>` for every k below `specParts`, each exactly the runner with
 * `--part k/n`, and no other part — `//#check` runs the parts, never
 * `test:spec`, so a suite without them would not gate at all.
 */
export function specPartProblems(
  dir: string,
  manifest: Pick<Manifest, 'specParts' | 'scripts'>
): readonly string[] {
  const scripts = manifest.scripts ?? {};
  if (scripts['test:spec'] === undefined) return [];
  const count = manifest.specParts;
  if (
    count === undefined ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_SPEC_PARTS
  ) {
    return [
      `${dir}/package.json: specParts must be an integer from 1 to ${String(MAX_SPEC_PARTS)} — bun check runs the suite as test:spec:0 … test:spec:<specParts - 1>`,
    ];
  }
  const out: string[] = [];
  for (const [name, script] of Object.entries(scripts)) {
    const match = /^test:spec:(\d+)$/.exec(name);
    if (match === null) continue;
    const index = Number(match[1]);
    const want = `${SPEC_RUNNER} --part ${String(index)}/${String(count)}`;
    if (index >= count) {
      out.push(
        `${dir}/package.json: "${name}" is past specParts (${String(count)}) — delete it`
      );
    } else if (script !== want) {
      out.push(`${dir}/package.json: "${name}" must be "${want}"`);
    }
  }
  for (let index = 0; index < count; index++) {
    if (scripts[`test:spec:${String(index)}`] === undefined) {
      out.push(
        `${dir}/package.json: "test:spec:${String(index)}" is missing — "${SPEC_RUNNER} --part ${String(index)}/${String(count)}"`
      );
    }
  }
  return out;
}

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
  return readSteps([`${SHARED_STEPS_DIR}/platform.ts`]);
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
      `${dir}: runs Quint models but has no tests/quint/index.ts (it loads every *.binding.ts and calls useQuintHarness)`
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
    // A package-local `@spec-meta` model is test machinery rather than a
    // product specification. The location gate checks that distinction.
    if (existsSync(join(REPO_ROOT, quintDir, `${model}.qnt`))) continue;
    if (!stems.has(model)) {
      problems.push(
        `${files.join(', ')}: binds model "${model}", which is not a specs/<domain>/${model}.qnt of this package's specDomains`
      );
    }
  }
  return problems;
}

/**
 * The specs of `kind` a package runs: the harness runner checks every kind in
 * `specDomains`, a live run only objectives in `liveDomains`.
 */
function kindSpecs(
  kind: BindingKind,
  specDomains: readonly string[],
  liveDomains: readonly string[]
): readonly string[] {
  const domains =
    kind.field === 'objectives'
      ? [...new Set([...specDomains, ...liveDomains])]
      : specDomains;
  return domains.flatMap((domain) => domainSpecPaths(domain, kind.suffix));
}

function kindProblems(
  dir: string,
  kind: BindingKind,
  specs: readonly string[]
): readonly string[] {
  const bindingDir = join(REPO_ROOT, dir, 'tests', kind.dir);
  return bindingProblems({
    dir,
    kind,
    specs,
    files: listFiles(bindingDir, '.ts').map((file) => ({
      path: relative(REPO_ROOT, file),
      text: readFileSync(file, 'utf8'),
    })),
    hasEntry: existsSync(join(bindingDir, 'index.ts')),
  });
}

function readFeatures(domains: readonly string[]): readonly SpecFeature[] {
  return domains.flatMap((domain) =>
    domainFeaturePaths(domain).map((uri) =>
      parseFeature(readFileSync(join(REPO_ROOT, uri), 'utf8'), uri)
    )
  );
}

/** Resolve a flat exported step module in its owning harness package. */
function resolveStepImport(
  specifier: string,
  byName: ReadonlyMap<string, string>
): string | null {
  const match = /^(@[a-z]+\/[a-z0-9-]+)\/([^/]+\.steps)$/.exec(specifier);
  if (match === null) return null;
  const dir = byName.get(match[1] ?? '');
  if (dir === undefined) return null;
  return `${dir}/src/${match[2] ?? ''}.ts`;
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

function packageNames(dirs: readonly string[]): Map<string, string> {
  const byName = new Map<string, string>();
  for (const dir of dirs) {
    const manifest = readManifest(dir);
    if (manifest.name !== undefined) byName.set(manifest.name, dir);
  }
  return byName;
}

function bindingPaths(
  specDomains: readonly string[],
  liveDomains: readonly string[]
): Record<BindingKind['field'], readonly string[]> {
  return Object.fromEntries(
    BINDING_KINDS.map((kind) => [
      kind.field,
      kindSpecs(kind, specDomains, liveDomains),
    ])
  ) as Record<BindingKind['field'], readonly string[]>;
}

/** Step files a steps entry imports, and whether it pulls in the shared steps. */
function stepImports(
  stepsEntry: string,
  byName: ReadonlyMap<string, string>,
  problems: string[]
): { readonly imports: readonly string[]; readonly sharedSteps: boolean } {
  const imports: string[] = [];
  let sharedSteps = false;
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
  return { imports, sharedSteps };
}

/** Every package that runs spec domains (`specDomains` / `liveDomains`), in path order. */
export function specPackages(): readonly SpecPackage[] {
  const dirs = packageDirs();
  const byName = packageNames(dirs);
  const synthetic = syntheticFeatures();
  const liveObjectives = liveObjectivePaths();
  const out: SpecPackage[] = [];
  for (const dir of dirs) {
    const manifest = readManifest(dir);
    const specDomains = manifest.specDomains ?? [];
    const liveDomains = manifest.liveDomains ?? [];
    const domains = [...new Set([...specDomains, ...liveDomains])];
    if (domains.length === 0) continue;
    const entryPath = `${dir}/tests/steps/index.ts`;
    const stepsEntry = existsSync(join(REPO_ROOT, entryPath))
      ? entryPath
      : null;
    const own = readSteps([
      ...stepFiles(`${dir}/tests/steps`),
      ...stepFiles(`${dir}/src`).filter((file) => file.endsWith('.steps.ts')),
    ]);
    const models = domains.flatMap(domainModelPaths);
    const kinds = bindingPaths(specDomains, liveDomains);
    const live = liveDomains.length > 0;
    const objectives = objectivesFor(kinds.objectives, liveObjectives, live);
    const problems: string[] = [
      ...own.problems,
      ...modelProblems(dir, models),
      ...BINDING_KINDS.flatMap((kind) =>
        kindProblems(
          dir,
          kind,
          kind.field === 'objectives' ? objectives : kinds[kind.field]
        )
      ),
    ];
    const linked =
      stepsEntry === null
        ? { imports: [] as readonly string[], sharedSteps: false }
        : stepImports(stepsEntry, byName, problems);
    if (stepsEntry === null) {
      problems.push(
        `${dir}: runs spec domains but has no tests/steps/index.ts`
      );
    }
    out.push({
      name: manifest.name ?? dir,
      dir,
      domains,
      specDomains,
      liveDomains,
      features: featuresFor(readFeatures(domains), synthetic, live),
      definitions: own.steps,
      imports: linked.imports,
      sharedSteps: linked.sharedSteps,
      stepsEntry,
      models,
      decisions: kinds.decisions,
      structures: kinds.structures,
      objectives,
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
 * The `specs/` tree is flat and fully owned: at its root only context
 * directories and the files `spec-kinds.ts` allows, in each bounded context
 * only the spec kinds that have a runner; every domain directory run by some package — by
 * at most one against the harness (`specDomains`) and at most one live
 * (`liveDomains`) — every claimed domain present, and no package keeping a
 * `features/` directory of its own.
 */
export function specsLayoutProblems(
  packages: readonly SpecPackage[]
): readonly string[] {
  const out: string[] = [];
  const root = join(REPO_ROOT, SPECS_DIR);
  const runners = runnersBy(packages, (pkg) => pkg.domains);
  const campaigns = specCampaigns(REPO_ROOT);
  for (const campaign of campaigns) {
    runners.set(campaign.domain, [
      ...(runners.get(campaign.domain) ?? []),
      campaign.dir,
    ]);
  }
  out.push(...campaignOwnershipProblems(campaigns, runners));
  const harnessRunners = runnersBy(packages, (pkg) => pkg.specDomains);
  const liveRunners = runnersBy(packages, (pkg) => pkg.liveDomains);
  const present = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
    : [];
  for (const entry of present) {
    const path = `${SPECS_DIR}/${entry.name}`;
    const rootProblem = specsRootEntryProblem(entry.name, entry.isDirectory());
    if (rootProblem !== null) out.push(rootProblem);
    if (!entry.isDirectory()) continue;
    for (const inner of readdirSync(join(root, entry.name), {
      withFileTypes: true,
    })) {
      const problem = contextEntryProblem(
        entry.name,
        inner.name,
        inner.isDirectory()
      );
      if (problem !== null) out.push(problem);
    }
    out.push(...unrunKindProblems(entry.name, harnessRunners));
    if ((runners.get(entry.name) ?? []).length === 0) {
      out.push(
        `${path}/: no package lists "${entry.name}" in its package.json specDomains or liveDomains`
      );
    }
    for (const [field, byDomain] of [
      ['specDomains', harnessRunners],
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
  for (const dir of packageDirs()) {
    out.push(...specPartProblems(dir, readManifest(dir)));
  }
  for (const pkg of packages) out.push(...specPartInputProblems(pkg));
  for (const pkg of packages) {
    out.push(
      ...modelTaskProblems(
        pkg,
        readManifest(pkg.dir).scripts ?? {},
        turboTasks(pkg.dir)['check:models']?.inputs
      )
    );
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

/**
 * A live run checks only features and objectives, so a decision table or
 * structure in a domain no package runs against the harness would never run.
 */
function unrunKindProblems(
  domain: string,
  harnessRunners: ReadonlyMap<string, readonly string[]>
): readonly string[] {
  if ((harnessRunners.get(domain) ?? []).length > 0) return [];
  return BINDING_KINDS.filter((kind) => kind.field !== 'objectives').flatMap(
    (kind) =>
      domainSpecPaths(domain, kind.suffix).map(
        (path) =>
          `${path}: no package lists "${domain}" in specDomains, and live runs check no ${kind.noun}s — it would never run`
      )
  );
}

type TurboTasks = Readonly<
  Record<string, { readonly inputs?: readonly string[] }>
>;

function turboTasks(dir: string): TurboTasks {
  const turbo = join(REPO_ROOT, dir, 'turbo.json');
  if (!existsSync(turbo)) return {};
  return (
    (JSON.parse(readFileSync(turbo, 'utf8')) as { readonly tasks?: TurboTasks })
      .tasks ?? {}
  );
}

/** Each `test:spec:<k>` must hash the specs of every domain the package runs. */
function specPartInputProblems(pkg: SpecPackage): readonly string[] {
  const tasks = turboTasks(pkg.dir);
  const parts = Object.keys(readManifest(pkg.dir).scripts ?? {}).filter(
    (name) => /^test:spec:\d+$/.test(name)
  );
  const out: string[] = [];
  for (const part of parts) {
    const inputs = tasks[part]?.inputs ?? [];
    for (const domain of pkg.specDomains) {
      const input = `$TURBO_ROOT$/${SPECS_DIR}/${domain}/**`;
      if (!inputs.includes(input)) {
        out.push(
          `${pkg.dir}/turbo.json: ${part} inputs must include "${input}" so a spec change re-runs ${pkg.name}`
        );
      }
    }
  }
  return out;
}

/**
 * What is wrong with how a package checks its Quint models: `check:models` is
 * exactly {@link MODELS_RUNNER} when the package has models and absent when it
 * has none, and the task hashes the `.qnt` files of every domain holding one,
 * so editing a model re-checks that package's models and nothing else does.
 */
export function modelTaskProblems(
  pkg: Pick<SpecPackage, 'dir' | 'name' | 'models'>,
  scripts: Readonly<Record<string, string>>,
  inputs: readonly string[] | undefined
): readonly string[] {
  const script = scripts['check:models'];
  if (pkg.models.length === 0) {
    return script === undefined
      ? []
      : [
          `${pkg.dir}/package.json: "check:models" checks no Quint models — delete it`,
        ];
  }
  if (script !== MODELS_RUNNER) {
    return [
      `${pkg.dir}/package.json: "check:models" must be "${MODELS_RUNNER}" — it has Quint models to check`,
    ];
  }
  const domains = [
    ...new Set(pkg.models.map((uri) => uri.split('/')[1] ?? '')),
  ].sort();
  return domains.flatMap((domain) => {
    const input = `$TURBO_ROOT$/${SPECS_DIR}/${domain}/*.qnt`;
    return (inputs ?? []).includes(input)
      ? []
      : [
          `${pkg.dir}/turbo.json: check:models inputs must include "${input}" so a model change re-checks ${pkg.name}`,
        ];
  });
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
