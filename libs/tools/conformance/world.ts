// @io-wall-ok — reads specs/, the manifest, package manifests and turbo.json for the conformance gate and report.
/**
 * The facts the closed-world check decides over, read from the repository:
 * the manifest, every spec file with where it runs and whether it is bound
 * (`spec-packages.ts`, the same discovery as `@libs/tools#ci:specs`), every decision
 * table's capability values (`@pkgs/dmn`), every objective's service
 * (`@pkgs/openslo`) and the package tasks in `MAIN_CHECK_TASKS`. What cannot be read
 * (a manifest, decision table or objective file that does not parse) is a
 * problem, never skipped.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ClosureWorld,
  DecisionFacts,
  ObjectiveFacts,
} from '@pkgs/conformance-shared/closure';
import type { ConformanceManifest } from '@pkgs/conformance-shared/manifest';
import { parseManifest } from '@pkgs/conformance-shared/manifest';
import type { SpecFile, SpecFileKind } from '@pkgs/conformance-shared/proofs';
import { parseDmn } from '@pkgs/dmn-shared/model';
import { isSyntheticFeatureSource } from '@pkgs/gherkin-shared/tags';
import { isLiveObjectiveSource } from '@pkgs/openslo-shared/live';
import { parseOpenSlo } from '@pkgs/openslo-shared/parse';
import type { SpecPackage } from '../scripts/spec-packages';
import { REPO_ROOT, SPECS_DIR, specPackages } from '../scripts/spec-packages';
import { MAIN_CHECK_TASKS } from '../scripts/turbo-ci-run';
import { campaignBindings } from './campaigns';
import { EVIDENCE_MAP } from './evidence-map';
import type { PackageScripts, TurboTasks } from './gating-tasks';
import { reachableCheckTasks } from './gating-tasks';

export const MANIFEST_PATH = `${SPECS_DIR}/conformance.yaml`;
/** The task that runs a package's live domains against a deployment. */
const LIVE_TASK = 'health';
/** A decision table's capability input: its id, or its name. */
const CAPABILITY_INPUT = { id: 'capability', name: 'what they want to do' };

const KINDS: readonly (readonly [SpecFileKind, string, string])[] = [
  // kind, suffix, how a package-level binding problem names the kind
  ['behavior', '.feature', 'spec domains'],
  ['dynamics', '.qnt', 'Quint models'],
  ['decisions', '.dmn', 'decision tables'],
  ['structure', '.als', 'structures'],
  ['objectives', '.openslo.yaml', 'objective files'],
];

function kindOf(name: string): (typeof KINDS)[number] | null {
  if (name === 'events.qnt') return null;
  return KINDS.find(([, suffix]) => name.endsWith(suffix)) ?? null;
}

const read = (path: string): string =>
  readFileSync(join(REPO_ROOT, path), 'utf8');

export function specDirectories(): readonly string[] {
  return readdirSync(join(REPO_ROOT, SPECS_DIR), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** The live package runs its domains, plus every synthetic feature and `# live` objective. */
function runsLive(
  pkg: SpecPackage,
  input: {
    readonly context: string;
    readonly liveTask: boolean;
    readonly synthetic: boolean;
    readonly liveObjective: boolean;
  }
): boolean {
  if (!input.liveTask || !scriptsOf(pkg.dir).includes(LIVE_TASK)) return false;
  if (pkg.liveDomains.includes(input.context)) return true;
  if (pkg.liveDomains.length === 0) return false;
  return input.synthetic || input.liveObjective;
}

function scriptsOf(dir: string): readonly string[] {
  const manifest = JSON.parse(read(`${dir}/package.json`)) as {
    readonly scripts?: Readonly<Record<string, string>>;
  };
  return Object.keys(manifest.scripts ?? {});
}

/** Whether `pkg` lists `problem` against the spec: its path, or its kind as a whole. */
function unbound(pkg: SpecPackage, path: string, noun: string): boolean {
  return pkg.problems.some(
    (problem) =>
      problem.startsWith(`${path}:`) ||
      problem.startsWith(`${pkg.dir}: runs ${noun}`)
  );
}

function specFile(input: {
  readonly context: string;
  readonly name: string;
  readonly packages: readonly SpecPackage[];
  readonly liveTask: boolean;
}): SpecFile | null {
  const kind = kindOf(input.name);
  if (kind === null) return null;
  const [kindName, , noun] = kind;
  const path = `${SPECS_DIR}/${input.context}/${input.name}`;
  const text =
    kindName === 'behavior' || kindName === 'objectives' ? read(path) : '';
  const synthetic = kindName === 'behavior' && isSyntheticFeatureSource(text);
  const liveObjective =
    kindName === 'objectives' && isLiveObjectiveSource(text);
  const harness =
    synthetic || liveObjective
      ? []
      : input.packages.filter((pkg) => pkg.specDomains.includes(input.context));
  // A live run checks features and objectives only (spec-packages.ts).
  const liveKinds: readonly SpecFileKind[] = ['behavior', 'objectives'];
  const live = liveKinds.includes(kindName)
    ? input.packages.filter((pkg) =>
        runsLive(pkg, {
          context: input.context,
          liveTask: input.liveTask,
          synthetic,
          liveObjective,
        })
      )
    : [];
  const runners = [...harness, ...live];
  return {
    path,
    context: input.context,
    kind: kindName,
    harness: harness.length > 0,
    live: live.length > 0,
    bound:
      runners.length > 0 &&
      runners.every(
        (pkg) =>
          !unbound(pkg, path, noun) &&
          (kindName !== 'behavior' || pkg.stepsEntry !== null)
      ),
  };
}

export function specFiles(
  packages: readonly SpecPackage[],
  tasks: TurboTasks
): readonly SpecFile[] {
  const liveTask = Object.hasOwn(tasks, LIVE_TASK);
  const campaigns = campaignBindings(
    reachableCheckTasks(tasks, packageScripts(), MAIN_CHECK_TASKS)
  );
  return [
    ...campaigns.specs,
    ...specDirectories()
      .filter((context) => !campaigns.domains.has(context))
      .flatMap((context) =>
        readdirSync(join(REPO_ROOT, SPECS_DIR, context))
          .sort()
          .flatMap(
            (name) => specFile({ context, name, packages, liveTask }) ?? []
          )
      ),
  ];
}

function decisionFacts(
  specs: readonly SpecFile[],
  problems: string[]
): DecisionFacts[] {
  const out: DecisionFacts[] = [];
  for (const spec of specs.filter((s) => s.kind === 'decisions')) {
    const parsed = parseDmn(read(spec.path));
    if (!parsed.ok) {
      problems.push(
        `${spec.path}: does not read as a decision table — ${parsed.issues.join('; ')}`
      );
      continue;
    }
    // Capability closure concerns access answers. Other decisions still
    // belong to the spec inventory and run their own conformance binding.
    for (const decision of parsed.definitions.decisions.filter((decision) =>
      decision.outputs.some(
        (output) =>
          output.name === 'answer' &&
          output.values?.includes('yes') &&
          output.values.includes('no')
      )
    )) {
      const input = decision.inputs.find(
        (i) => i.id === CAPABILITY_INPUT.id || i.name === CAPABILITY_INPUT.name
      );
      out.push({
        specUri: spec.path,
        id: decision.id,
        capabilities:
          input === undefined
            ? null
            : input.domain.kind === 'values'
              ? input.domain.values.map(String)
              : [],
      });
    }
  }
  return out;
}

function objectiveFacts(
  specs: readonly SpecFile[],
  problems: string[]
): ObjectiveFacts[] {
  const out: ObjectiveFacts[] = [];
  for (const spec of specs.filter((s) => s.kind === 'objectives')) {
    const parsed = parseOpenSlo(read(spec.path));
    if (!parsed.ok) {
      problems.push(
        `${spec.path}: is not a well-formed objective — ${parsed.issues.join('; ')}`
      );
      continue;
    }
    for (const slo of parsed.doc.slos) {
      out.push({ specUri: spec.path, slo: slo.name, service: slo.service });
    }
  }
  return out;
}

export function turboTasks(): TurboTasks {
  return (JSON.parse(read('turbo.json')) as { readonly tasks: TurboTasks })
    .tasks;
}

export function packageScripts(): PackageScripts {
  const out = new Map<string, ReadonlySet<string>>();
  for (const tier of ['apps', 'libs', 'pkgs']) {
    for (const entry of readdirSync(join(REPO_ROOT, tier), {
      withFileTypes: true,
    })) {
      const dir = `${tier}/${entry.name}`;
      if (
        !entry.isDirectory() ||
        !existsSync(join(REPO_ROOT, dir, 'package.json'))
      )
        continue;
      const manifest = JSON.parse(read(`${dir}/package.json`)) as {
        readonly name?: string;
        readonly scripts?: Readonly<Record<string, string>>;
      };
      out.set(
        manifest.name ?? dir,
        new Set(Object.keys(manifest.scripts ?? {}))
      );
    }
  }
  return out;
}

export type ConformanceWorld = {
  /** Null when the manifest does not parse (its issues are in `problems`). */
  readonly world: ClosureWorld | null;
  readonly manifest: ConformanceManifest | null;
  readonly packages: readonly SpecPackage[];
  readonly specs: readonly SpecFile[];
  /** What kept a file from being read. */
  readonly problems: readonly string[];
};

/** Read everything the closed-world check needs. */
export function readConformanceWorld(): ConformanceWorld {
  const problems: string[] = [];
  const parsed = parseManifest(read(MANIFEST_PATH));
  if (!parsed.ok)
    problems.push(
      ...parsed.issues.map((issue) => `${MANIFEST_PATH}: ${issue}`)
    );
  const packages = specPackages();
  const tasks = turboTasks();
  const gatingTasks = reachableCheckTasks(
    tasks,
    packageScripts(),
    MAIN_CHECK_TASKS
  );
  const campaigns = campaignBindings(gatingTasks);
  problems.push(...campaigns.problems);
  const specs = specFiles(packages, tasks);
  const decisions = decisionFacts(specs, problems);
  const objectives = objectiveFacts(specs, problems);
  const manifest = parsed.ok ? parsed.manifest : null;
  const world: ClosureWorld | null =
    manifest === null
      ? null
      : {
          manifest,
          specDirectories: specDirectories().filter(
            (domain) => !campaigns.domains.has(domain)
          ),
          specs,
          decisions,
          objectives,
          evidence: EVIDENCE_MAP,
          gatingTasks,
        };
  return { world, manifest, packages, specs, problems };
}
