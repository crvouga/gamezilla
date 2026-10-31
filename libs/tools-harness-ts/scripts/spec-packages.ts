/**
 * Discovery for the spec gates. Every spec lives in the flat top-level tree
 * `specs/<domain>/` — Gherkin features (`<feature>.feature`), Quint models
 * (`<model>.qnt`), DMN decision tables (`.dmn`), Alloy structures (`.als`)
 * and OpenSLO objectives (`.openslo.yaml`, see `spec-kinds.ts`); a workspace
 * package runs the domains its `package.json`
 * lists in `specDomains` (against the harness, in its `test:spec`) and in
 * `liveDomains` (against a released environment, in its `health`). For each
 * such package: its parsed features, the step definitions its `tests/steps/**`
 * declare (read statically), the step files of other packages its steps entry
 * imports, its models with the bindings its `tests/quint/**` declare, and its
 * decision tables, structures and objectives with their `tests/<kind>/**`
 * bindings. The harness runner (`test-spec.ts`) runs every kind in
 * `specDomains`; a live run (`health`) runs features and objectives in
 * `liveDomains`, plus every `@synthetic` feature and every `# live`
 * objective, so a live package binds those wherever they sit.
 * Shared with `verify-specs.ts`, `spec-catalog.ts` and `spec-run.ts`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix, relative, resolve } from 'node:path';
import { specInputProblems } from '@libs/harness-ts/spec-inputs';
import type { PackageSpecs } from '@pkgs/gherkin-shared-ts/check';
import type { ExtractedStep } from '@pkgs/gherkin-shared-ts/extract';
import {
  extractStepImports,
  extractSteps,
} from '@pkgs/gherkin-shared-ts/extract';
import type { SpecFeature } from '@pkgs/gherkin-shared-ts/parse';
import { parseFeature } from '@pkgs/gherkin-shared-ts/parse';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import { formatPhaseArg, parsePhaseArg } from './model-phase';
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
export const SHARED_STEPS_DIR = 'libs/harness-ts/src';
export const SPECS_DIR = 'specs';
/** The specifier prefix a steps entry registers the shared steps with. */
const SHARED_STEPS_IMPORT = '@libs/harness-ts/platform';
const TIERS = ['apps', 'libs', 'pkgs'] as const;
/** The spec runner every `test:spec` and `test:spec:<k>` script calls. */
const SPEC_RUNNER = 'bun run ../../libs/harness-ts/scripts/test-spec.ts';
/** The Quint models verification (`verify:models`) of every package with models. */
export const MODELS_RUNNER =
  'bun run ../../libs/tools-harness-ts/scripts/verify-models.ts';
/**
 * Most parts one suite may split into: root `turbo.json` defines
 * `test:spec:0` … `test:spec:<MAX_SPEC_PARTS - 1>` and the sharded Verify runs them.
 */
export const MAX_SPEC_PARTS = 181;
/**
 * The most parts a package's models verification splits into (`verify:models:<k>`).
 * `turbo.json` declares that many; one part is one runner in the sharded
 * Verification, and a model's proof is the least a part can hold.
 */
export const MAX_MODEL_PARTS = 22;

export type SpecPackage = PackageSpecs & {
  /** Repo-relative package directory. */
  readonly dir: string;
  /** Domains run against the harness (`test:spec`). */
  readonly specDomains: readonly string[];
  /** Domains run against a released environment (`health`). */
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
  /** The `specs/<domain>/` directories this package runs against a release. */
  readonly liveDomains?: readonly string[];
  /** How many `test:spec:<k>` parts `bun verify` splits the suite into. */
  readonly specParts?: number;
  /** How many `verify:models:<k>` parts the models verification splits into. */
  readonly modelParts?: number;
  /**
   * How many proof phases the package's one model splits into.
   * `proofGroups` names each task's share (`4`, `0-3,5-11`); without it,
   * each phase is its own `verify:models:<k>`.
   */
  readonly proofParts?: number;
  readonly proofGroups?: readonly string[];
  /**
   * Model parts whose proof is split further (`verify:models:<part>:<phase>`).
   * Keys are part indexes.
   */
  readonly phaseParts?: Readonly<Record<string, number>>;
  readonly scripts?: Readonly<Record<string, string>>;
};

/**
 * What is wrong with how a package splits its spec suite for `bun verify`:
 * `test:spec:<k>` for every k below `specParts`, each exactly the runner with
 * `--part k/n`, and no other part — the sharded Verify runs the parts, never
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
      `${dir}/package.json: specParts must be an integer from 1 to ${String(MAX_SPEC_PARTS)} — bun verify runs the suite as test:spec:0 … test:spec:<specParts - 1>`,
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
    .map((file) => slashPath(relative(REPO_ROOT, file)))
    .filter(
      (file) => !file.endsWith('.test.ts') && !file.endsWith('/index.ts')
    );
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
    const rel = slashPath(relative(REPO_ROOT, file));
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
    // product specification. The location gate verifies that distinction.
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
 * The specs of `kind` a package runs: the harness runner verifies every kind in
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
      path: slashPath(relative(REPO_ROOT, file)),
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
  byName: ReadonlyMap<string, string>,
  importer: string
): string | null {
  if (specifier.startsWith('.') && specifier.endsWith('.steps'))
    return posix.join(posix.dirname(importer), `${specifier}.ts`);
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
  const pending = [stepsEntry];
  const seen = new Set(pending);
  for (const entry of pending) {
    for (const specifier of extractStepImports(
      readFileSync(join(REPO_ROOT, entry), 'utf8')
    )) {
      if (specifier.startsWith(SHARED_STEPS_IMPORT)) sharedSteps = true;
      const file = resolveStepImport(specifier, byName, entry);
      if (file === null || seen.has(file)) continue;
      if (!existsSync(join(REPO_ROOT, file))) {
        problems.push(
          `${entry}: imports ${specifier} but ${file} does not exist`
        );
        continue;
      }
      seen.add(file);
      imports.push(file);
      pending.push(file);
    }
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
  for (const pkg of packages)
    out.push(
      ...modelTaskProblems(
        pkg,
        readManifest(pkg.dir).scripts ?? {},
        turboTasks(pkg.dir)['verify:models']?.inputs,
        modelSplitOf(pkg.dir)
      )
    );
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
 * A live run verifies only features and objectives, so a decision table or
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
          `${path}: no package lists "${domain}" in specDomains, and live runs verify no ${kind.noun}s — it would never run`
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

/** Every part inherits its exact generated spec fingerprint, including model imports. */
function specPartInputProblems(pkg: SpecPackage): readonly string[] {
  const tasks = turboTasks(pkg.dir);
  const root = turboTasks('');
  const parts = Object.keys(readManifest(pkg.dir).scripts ?? {}).filter(
    (name) => /^test:spec:\d+$/.test(name)
  );
  return [
    ...specInputProblems(join(REPO_ROOT, pkg.dir), REPO_ROOT),
    ...parts.flatMap((part) => {
      const local = tasks[part]?.inputs;
      const inherited = root[part]?.inputs ?? [];
      const inputs =
        local?.flatMap((input) =>
          input === '$TURBO_EXTENDS$' ? [...inherited] : [input]
        ) ?? inherited;
      const input = `.cache/spec-inputs/part-${part.split(':').at(-1)}.json`;
      return inputs.includes(input)
        ? []
        : [
            `${pkg.dir}/turbo.json: ${part} inputs must include "${input}" so its assigned specs invalidate the verdict`,
          ];
    }),
  ];
}

/**
 * What is wrong with how a package verifies its Quint models: `verify:models` is
 * exactly {@link MODELS_RUNNER} when the package has models and absent when it
 * has none, and the task hashes the `.qnt` files of every domain holding one,
 * so editing a model re-verifies that package's models and nothing else does.
 *
 * A package whose proofs outlast one runner declares `modelParts` instead:
 * `verify:models:<k>` for every k below it, each the runner with `--part k/n`,
 * and no unsplit `verify:models`.
 */
type ModelSplit = {
  readonly count: number | undefined;
  readonly proofParts?: number;
  readonly proofGroups?: readonly string[];
  readonly phaseParts?: Readonly<Record<string, number>>;
  readonly inputsOf: (task: string) => readonly string[] | undefined;
};

const MODEL_TASK = /^verify:models:\d+(?::\d+)?$/;

function modelDomains(models: readonly string[]): readonly string[] {
  return [...new Set(models.map((uri) => uri.split('/')[1] ?? ''))].sort();
}

function unhashedModel(
  pkg: Pick<SpecPackage, 'dir' | 'name'>,
  task: string,
  taskInputs: readonly string[] | undefined,
  domains: readonly string[]
): readonly string[] {
  return domains.flatMap((domain) => {
    const input = `$TURBO_ROOT$/${SPECS_DIR}/${domain}/*.qnt`;
    return (taskInputs ?? []).includes(input)
      ? []
      : [
          `${pkg.dir}/turbo.json: ${task} inputs must include "${input}" so a model change re-verifies ${pkg.name}`,
        ];
  });
}

function modelSplitOf(dir: string): ModelSplit {
  const manifest = readManifest(dir);
  return {
    count: manifest.modelParts,
    ...(manifest.proofParts === undefined
      ? {}
      : { proofParts: manifest.proofParts }),
    ...(manifest.proofGroups === undefined
      ? {}
      : { proofGroups: manifest.proofGroups }),
    ...(manifest.phaseParts === undefined
      ? {}
      : { phaseParts: manifest.phaseParts }),
    inputsOf: (task) => turboTasks(dir)[task]?.inputs,
  };
}

function proofPartProblems(
  pkg: Pick<SpecPackage, 'dir' | 'name' | 'models'>,
  scripts: Readonly<Record<string, string>>,
  parts: ModelSplit
): readonly string[] {
  const count = parts.proofParts ?? 0;
  if (pkg.models.length !== 1) {
    return [
      `${pkg.dir}/package.json: proofParts splits the one model this package verifications — it has ${String(pkg.models.length)}`,
    ];
  }
  if (!Number.isInteger(count) || count < 2 || count > MAX_MODEL_PARTS) {
    return [
      `${pkg.dir}/package.json: proofParts must be an integer from 2 to ${String(MAX_MODEL_PARTS)}`,
    ];
  }
  const groups = resolveProofGroups(parts, count);
  if ('error' in groups) {
    return [`${pkg.dir}/package.json: ${groups.error}`];
  }
  return proofScriptProblems({
    pkg,
    scripts,
    parts,
    count,
    groups: groups.groups,
  });
}

function resolveProofGroups(
  parts: ModelSplit,
  count: number
): { readonly groups: readonly string[] } | { readonly error: string } {
  const declared = parts.proofGroups;
  if (declared === undefined) {
    return {
      groups: Array.from({ length: count }, (_, index) => String(index)),
    };
  }
  const covered: number[] = [];
  for (const [at, group] of declared.entries()) {
    const parsed = parsePhaseArg(`${group}/${String(count)}`);
    const canonical =
      parsed === null ? null : formatPhaseArg(parsed.indexes, count);
    if (parsed === null || canonical !== `${group}/${String(count)}`) {
      return {
        error: `proofGroups[${String(at)}] must be canonical phases inside ${String(count)}, like "0-3,5"`,
      };
    }
    covered.push(...parsed.indexes);
  }
  if (new Set(covered).size !== count || covered.length !== count) {
    return {
      error: `proofGroups must cover each of the ${String(count)} phases once`,
    };
  }
  return { groups: declared };
}

function proofScriptProblems(input: {
  readonly pkg: Pick<SpecPackage, 'dir' | 'name' | 'models'>;
  readonly scripts: Readonly<Record<string, string>>;
  readonly parts: ModelSplit;
  readonly count: number;
  readonly groups: readonly string[];
}): readonly string[] {
  const { pkg, scripts, parts, count, groups } = input;
  const domains = modelDomains(pkg.models);
  const out: string[] = [];
  if (scripts['verify:models'] !== undefined) {
    out.push(
      `${pkg.dir}/package.json: "verify:models" would verify every phase again — the ${String(groups.length)} tasks replace it; delete it`
    );
  }
  for (const [index, group] of groups.entries()) {
    const name = `verify:models:${String(index)}`;
    const want = `${MODELS_RUNNER} --phase ${group}/${String(count)}`;
    if (scripts[name] !== want)
      out.push(`${pkg.dir}/package.json: "${name}" must be "${want}"`);
    out.push(...unhashedModel(pkg, name, parts.inputsOf(name), domains));
  }
  const limit =
    parts.proofGroups === undefined
      ? `proofParts (${String(count)})`
      : `${String(groups.length)} proof groups`;
  for (const name of Object.keys(scripts)) {
    if (!MODEL_TASK.test(name)) continue;
    const index = Number(name.split(':')[2]);
    if (index >= groups.length) {
      out.push(
        `${pkg.dir}/package.json: "${name}" is past ${limit} — delete it`
      );
    }
  }
  return out;
}

function strayModelTask(
  name: string,
  count: number,
  phaseParts: ModelSplit['phaseParts']
): string | null {
  const pieces = name.split(':');
  const index = Number(pieces[2]);
  if (!Number.isInteger(index) || index >= count) {
    return `"${name}" is past modelParts (${String(count)}) — delete it`;
  }
  if (pieces.length !== 4) return null;
  const phases = phaseParts?.[String(index)];
  const phase = Number(pieces[3]);
  if (phases === undefined) {
    return `"${name}" is a phase of no split — declare phaseParts or delete it`;
  }
  if (!Number.isInteger(phase) || phase >= phases) {
    return `"${name}" is past phaseParts["${String(index)}"] (${String(phases)}) — delete it`;
  }
  return null;
}

function oneModelPart(input: {
  readonly pkg: Pick<SpecPackage, 'dir' | 'name'>;
  readonly scripts: Readonly<Record<string, string>>;
  readonly parts: ModelSplit;
  readonly index: number;
  readonly count: number;
  readonly domains: readonly string[];
}): readonly string[] {
  const { pkg, scripts, parts, index, count, domains } = input;
  const phases = parts.phaseParts?.[String(index)];
  if (phases === undefined) {
    const name = `verify:models:${String(index)}`;
    const want = `${MODELS_RUNNER} --part ${String(index)}/${String(count)}`;
    return [
      ...(scripts[name] === want
        ? []
        : [`${pkg.dir}/package.json: "${name}" must be "${want}"`]),
      ...unhashedModel(pkg, name, parts.inputsOf(name), domains),
    ];
  }
  if (!Number.isInteger(phases) || phases < 2) {
    return [
      `${pkg.dir}/package.json: phaseParts["${String(index)}"] must be an integer of at least 2`,
    ];
  }
  const whole = `verify:models:${String(index)}`;
  const out: string[] = [];
  if (scripts[whole] !== undefined) {
    out.push(
      `${pkg.dir}/package.json: "${whole}" would verify every phase again — the ${String(phases)} phases replace it; delete it`
    );
  }
  for (let phase = 0; phase < phases; phase++) {
    const name = `${whole}:${String(phase)}`;
    const want = `${MODELS_RUNNER} --part ${String(index)}/${String(count)} --phase ${String(phase)}/${String(phases)}`;
    if (scripts[name] !== want)
      out.push(`${pkg.dir}/package.json: "${name}" must be "${want}"`);
    out.push(...unhashedModel(pkg, name, parts.inputsOf(name), domains));
  }
  return out;
}

export function modelTaskProblems(
  pkg: Pick<SpecPackage, 'dir' | 'name' | 'models'>,
  scripts: Readonly<Record<string, string>>,
  inputs: readonly string[] | undefined,
  parts?: ModelSplit
): readonly string[] {
  const script = scripts['verify:models'];
  const partNames = Object.keys(scripts).filter((name) =>
    MODEL_TASK.test(name)
  );
  if (pkg.models.length === 0) {
    return [script === undefined ? [] : ['verify:models'], partNames]
      .flat()
      .map(
        (name) =>
          `${pkg.dir}/package.json: "${name}" verifies no Quint models — delete it`
      );
  }
  if (parts?.proofParts !== undefined) {
    if (parts.count !== undefined) {
      return [
        `${pkg.dir}/package.json: proofParts replaces modelParts — delete one`,
      ];
    }
    return proofPartProblems(pkg, scripts, parts);
  }
  const domains = modelDomains(pkg.models);
  const count = parts?.count;
  if (count === undefined) {
    if (script !== MODELS_RUNNER) {
      return [
        `${pkg.dir}/package.json: "verify:models" must be "${MODELS_RUNNER}" — it has Quint models to verify`,
      ];
    }
    return [
      ...partNames.map(
        (name) =>
          `${pkg.dir}/package.json: "${name}" is a part of no split — declare modelParts or delete it`
      ),
      ...unhashedModel(pkg, 'verify:models', inputs, domains),
    ];
  }
  const most = Math.min(MAX_MODEL_PARTS, pkg.models.length);
  if (!Number.isInteger(count) || count < 2 || count > most) {
    return [
      `${pkg.dir}/package.json: modelParts must be an integer from 2 to ${String(most)} — a part holds at least one of the package's ${String(pkg.models.length)} models`,
    ];
  }
  const out: string[] = [];
  if (script !== undefined) {
    out.push(
      `${pkg.dir}/package.json: "verify:models" would verify every model again — the ${String(count)} parts replace it; delete it`
    );
  }
  for (const name of partNames) {
    const stray = strayModelTask(name, count, parts?.phaseParts);
    if (stray !== null) out.push(`${pkg.dir}/package.json: ${stray}`);
  }
  if (parts === undefined) return out;
  for (let index = 0; index < count; index++)
    out.push(...oneModelPart({ pkg, scripts, parts, index, count, domains }));
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
