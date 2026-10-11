// @io-wall-ok — reads the workspace graph and the measured task-cost file.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { estimateTask } from './check-task-estimates';

/** Push to a posted verdict, including a full cold corpus. */
export const PR_CHECK_SECONDS = 300;
/** Every graph leaf, including the slowest one. */
export const LEAF_CHECK_SECONDS = 180;
/** Nine out of ten leaves. */
export const NARROW_CHECK_SECONDS = 90;
/** Fetch, plan, and cache lookup on a runner that already has the install. */
export const WARM_START_SECONDS = 30;
/** Post the verdict after the last task. */
export const SLACK_SECONDS = 15;
/** Task makespan inside the five-minute promise. */
export const WORK_BUDGET_SECONDS = 240;
/** Same cap as `specWorkerCeiling` in `@pkgs/os-server`. */
export const SPEC_WORKER_CAP = 16;
/** Two cores stay free for the model solver and the OS. */
export const RESERVED_CORES = 2;
/** One product world, rounded up from the measured 1.7 GB. */
export const SPEC_WORKER_GIB = 2;
/** RAM left for the OS, the solver, and the report writer. */
export const RESERVE_GIB = 8;
/** Provisioned shape. The fit test fails when the corpus needs more. */
export const RUNNER_VCPU = 32;
export const RUNNER_RAM_GIB = 64;
export const RUNNER_COUNT = 2;

const START = '<!-- ci-load:start -->';
const END = '<!-- ci-load:end -->';
const TIERS = ['apps', 'libs', 'pkgs'] as const;
const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
] as const;
const EXACT_TASKS = new Set([
  'tc',
  'lint',
  'test',
  'test:contract',
  'check:models',
  'check:worker-bundle',
  'check:offline-shell',
  'check:schema-evolution',
  'check:actionlint',
  'check:secrets',
  'check:board-contract',
  'check:root-lint',
  'check:synthetic-population',
  'check:synthetic-population-foundation',
  'ci:syncpack',
  'ci:audit',
  'ci:i18n',
  'ci:agent-commands',
  'ci:workspace-lifecycle',
  'ci:goals',
  'ci:specs',
  'ci:statecharts',
  'ci:conformance',
  'ci:spec-ownership',
]);

export type PackageWork = {
  readonly name: string;
  readonly dependencies: readonly string[];
  readonly tasks: readonly string[];
};

export type LoadInput = {
  readonly packages: readonly PackageWork[];
  readonly costs: Readonly<Record<string, number>>;
};

export type PackageLoad = {
  readonly name: string;
  readonly seconds: number;
  readonly poleSeconds: number;
  readonly poleTask: string;
  readonly tasks: number;
};

export type FamilyLoad = {
  readonly family: string;
  readonly tasks: number;
  readonly seconds: number;
};

export type ConeLoad = {
  readonly name: string;
  readonly packages: number;
  readonly seconds: number;
  readonly poleSeconds: number;
  readonly poleTask: string;
};

export type RunnerFit = {
  readonly specSlots: number;
  readonly otherSlots: number;
  readonly cores: number;
  readonly memoryGib: number;
  readonly makespanSeconds: number;
  readonly fits: boolean;
};

export type LoadReport = {
  readonly packages: number;
  readonly tasks: number;
  readonly measuredTasks: number;
  readonly estimatedTasks: number;
  readonly staleCostKeys: number;
  readonly coldSeconds: number;
  readonly specTasks: number;
  readonly specSeconds: number;
  readonly poleSeconds: number;
  readonly poleTask: string;
  readonly families: readonly FamilyLoad[];
  readonly leaves: readonly PackageLoad[];
  readonly leafOwnP50: number;
  readonly leafOwnP90: number;
  readonly leafPoleP90: number;
  readonly leafPoleMax: number;
  readonly cones: readonly ConeLoad[];
  readonly fit: RunnerFit;
};

/** A package script that the Check gate schedules. */
export function isCheckTask(name: string): boolean {
  return EXACT_TASKS.has(name) || /^test:spec:\d+$/.test(name);
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.floor((sorted.length - 1) * p)
  );
  return sorted[index] ?? 0;
}

/** Slots and memory the warm runner needs for this corpus. */
export function runnerFit(load: {
  readonly specSeconds: number;
  readonly coldSeconds: number;
  readonly poleSeconds: number;
  readonly leafPoleMax: number;
  readonly leafPoleP90: number;
}): RunnerFit {
  const otherSeconds = Math.max(0, load.coldSeconds - load.specSeconds);
  const specSlots = slotsFor(load.specSeconds);
  const otherSlots = slotsFor(otherSeconds);
  const cores = specSlots + RESERVED_CORES + otherSlots;
  const memoryGib = specSlots * SPEC_WORKER_GIB + RESERVE_GIB;
  const makespanSeconds = Math.ceil(
    Math.max(
      load.poleSeconds,
      span(load.specSeconds, specSlots),
      span(otherSeconds, otherSlots)
    )
  );
  const fits =
    specSlots <= SPEC_WORKER_CAP &&
    cores <= RUNNER_VCPU &&
    memoryGib <= RUNNER_RAM_GIB &&
    makespanSeconds + WARM_START_SECONDS <= PR_CHECK_SECONDS &&
    load.leafPoleMax + WARM_START_SECONDS + SLACK_SECONDS <=
      LEAF_CHECK_SECONDS &&
    load.leafPoleP90 + WARM_START_SECONDS + SLACK_SECONDS <=
      NARROW_CHECK_SECONDS;
  return { specSlots, otherSlots, cores, memoryGib, makespanSeconds, fits };
}

function slotsFor(seconds: number): number {
  if (seconds <= 0) return 0;
  return Math.ceil(seconds / WORK_BUDGET_SECONDS);
}

function span(seconds: number, slots: number): number {
  if (slots <= 0) return 0;
  return seconds / slots;
}

export function loadReport(input: LoadInput): LoadReport {
  const acc: Acc = {
    current: new Set<string>(),
    totals: emptyTotals(),
    families: new Map<string, FamilyLoad>(),
  };
  const own = new Map<string, PackageLoad>();
  for (const pkg of input.packages)
    own.set(pkg.name, packageLoad(pkg, input.costs, acc));
  const counts = dependentCounts(input.packages);
  const leaves = [...own.values()]
    .filter((load) => (counts.get(load.name) ?? 0) === 0)
    .filter((load) => load.tasks > 0)
    .sort(bySeconds);
  const cones = input.packages
    .map((pkg) => coneLoad(pkg.name, input.packages, own))
    .sort(bySeconds)
    .slice(0, 3);
  const leafPoles = leaves.map((load) => load.poleSeconds);
  const report = {
    packages: input.packages.length,
    tasks: acc.totals.tasks,
    measuredTasks: acc.totals.measured,
    estimatedTasks: acc.totals.estimated,
    staleCostKeys: Object.keys(input.costs).filter((id) => !acc.current.has(id))
      .length,
    coldSeconds: acc.totals.cold,
    specTasks: acc.totals.specTasks,
    specSeconds: acc.totals.specSeconds,
    poleSeconds: acc.totals.poleSeconds,
    poleTask: acc.totals.poleTask,
    families: [...acc.families.values()].sort(bySeconds).slice(0, 8),
    leaves,
    leafOwnP50: percentile(
      leaves.map((load) => load.seconds),
      0.5
    ),
    leafOwnP90: percentile(
      leaves.map((load) => load.seconds),
      0.9
    ),
    leafPoleP90: percentile(leafPoles, 0.9),
    leafPoleMax: leaves.reduce(
      (max, load) => Math.max(max, load.poleSeconds),
      0
    ),
    cones,
  };
  return { ...report, fit: runnerFit(report) };
}

type Totals = {
  tasks: number;
  measured: number;
  estimated: number;
  cold: number;
  specTasks: number;
  specSeconds: number;
  poleSeconds: number;
  poleTask: string;
};

function emptyTotals(): Totals {
  return {
    tasks: 0,
    measured: 0,
    estimated: 0,
    cold: 0,
    specTasks: 0,
    specSeconds: 0,
    poleSeconds: 0,
    poleTask: '',
  };
}

type Acc = {
  readonly current: Set<string>;
  readonly totals: Totals;
  readonly families: Map<string, FamilyLoad>;
};

function packageLoad(
  pkg: PackageWork,
  costs: Readonly<Record<string, number>>,
  acc: Acc
): PackageLoad {
  let seconds = 0;
  let poleSeconds = 0;
  let poleTask = pkg.name;
  for (const task of pkg.tasks) {
    const id = `${pkg.name}#${task}`;
    acc.current.add(id);
    const estimate = estimateTask(id, costs);
    seconds += estimate.seconds;
    recordTask(acc, id, estimate.seconds, estimate.durationSource);
    if (estimate.seconds > poleSeconds) {
      poleSeconds = estimate.seconds;
      poleTask = id;
    }
  }
  return {
    name: pkg.name,
    seconds,
    poleSeconds,
    poleTask,
    tasks: pkg.tasks.length,
  };
}

function recordTask(
  acc: Acc,
  id: string,
  seconds: number,
  source: 'history' | 'family' | 'fallback'
): void {
  const { totals, families } = acc;
  totals.tasks += 1;
  totals.cold += seconds;
  if (source === 'history') totals.measured += 1;
  else totals.estimated += 1;
  if (seconds > totals.poleSeconds) {
    totals.poleSeconds = seconds;
    totals.poleTask = id;
  }
  const family = id.slice(id.indexOf('#') + 1).replace(/:\d+$/, '');
  if (family === 'test:spec') {
    totals.specTasks += 1;
    totals.specSeconds += seconds;
  }
  const row = families.get(family) ?? { family, tasks: 0, seconds: 0 };
  families.set(family, {
    family,
    tasks: row.tasks + 1,
    seconds: row.seconds + seconds,
  });
}

function dependentCounts(
  packages: readonly PackageWork[]
): Map<string, number> {
  const counts = new Map(packages.map((pkg) => [pkg.name, 0]));
  for (const pkg of packages)
    for (const dep of pkg.dependencies) {
      const count = counts.get(dep);
      if (count === undefined) continue;
      counts.set(dep, count + 1);
    }
  return counts;
}

function coneLoad(
  name: string,
  packages: readonly PackageWork[],
  own: ReadonlyMap<string, PackageLoad>
): ConeLoad {
  const dependents = new Map(packages.map((pkg) => [pkg.name, [] as string[]]));
  for (const pkg of packages)
    for (const dep of pkg.dependencies) dependents.get(dep)?.push(pkg.name);
  const seen = new Set<string>([name]);
  const stack = [name];
  while (stack.length > 0) {
    const current = stack.pop() ?? name;
    for (const next of dependents.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(next);
    }
  }
  let seconds = 0;
  let poleSeconds = 0;
  let poleTask = name;
  for (const member of seen) {
    const load = own.get(member);
    if (!load) continue;
    seconds += load.seconds;
    if (load.poleSeconds > poleSeconds) {
      poleSeconds = load.poleSeconds;
      poleTask = load.poleTask;
    }
  }
  return { name, packages: seen.size, seconds, poleSeconds, poleTask };
}

function bySeconds<
  T extends { readonly seconds: number; readonly name?: string },
>(left: T, right: T): number {
  return (
    right.seconds - left.seconds ||
    (left.name ?? '').localeCompare(right.name ?? '')
  );
}

export function renderMeasuredLoad(report: LoadReport): string {
  return [
    intro(report),
    '',
    summaryTable(report),
    '',
    '### Families',
    '',
    familyTable(report.families),
    '',
    '### Leaves',
    '',
    leafTable(report),
    '',
    leafPackages(report.leaves.slice(0, 5)),
    '',
    '### Widest dependency cones',
    '',
    coneTable(report.cones),
    '',
    '### Runner',
    '',
    fitTable(report.fit),
  ].join('\n');
}

function intro(report: LoadReport): string {
  return [
    'Unmeasured scripts follow `estimateTask`: the family median when that family has a sample, otherwise 60 seconds.',
    `${String(report.staleCostKeys)} cost keys name tasks outside the current graph and stay out of the cold total.`,
    'The unit-test median is one second, the recorder floor. A family with no sample, such as an unmeasured `check:board-contract`, reserves 60 seconds until a cold Check is harvested.',
  ].join(' ');
}

function summaryTable(report: LoadReport): string {
  return [
    '| | |',
    '| --- | --- |',
    row('Packages', String(report.packages)),
    row('Check scripts', String(report.tasks)),
    row('Measured scripts', String(report.measuredTasks)),
    row('Estimated scripts', String(report.estimatedTasks)),
    row('Stale cost keys', String(report.staleCostKeys)),
    row('Cold CPU', seconds(report.coldSeconds)),
    row(
      'Spec parts',
      `${seconds(report.specSeconds)} across ${String(report.specTasks)} tasks`
    ),
    row('Longest task', `${report.poleTask} ${seconds(report.poleSeconds)}`),
  ].join('\n');
}

function familyTable(families: readonly FamilyLoad[]): string {
  const lines = ['| Family | Tasks | CPU |', '| --- | --- | --- |'];
  for (const family of families)
    lines.push(
      `| ${family.family} | ${String(family.tasks)} | ${seconds(family.seconds)} |`
    );
  return lines.join('\n');
}

function leafTable(report: LoadReport): string {
  return [
    `${String(report.leaves.length)} leaves have check scripts. On the warm runner their tasks run together, so the wall clock is the longest task plus the ${String(WARM_START_SECONDS)} s warm start.`,
    '',
    '| | |',
    '| --- | --- |',
    row('Leaf CPU, median', seconds(report.leafOwnP50)),
    row('Leaf CPU, 90th percentile', seconds(report.leafOwnP90)),
    row('Longest leaf task, 90th percentile', seconds(report.leafPoleP90)),
    row('Longest leaf task', seconds(report.leafPoleMax)),
  ].join('\n');
}

function leafPackages(leaves: readonly PackageLoad[]): string {
  const lines = ['| Package | CPU | Longest task |', '| --- | --- | --- |'];
  for (const leaf of leaves)
    lines.push(
      `| ${leaf.name} | ${seconds(leaf.seconds)} | ${leaf.poleTask} ${seconds(leaf.poleSeconds)} |`
    );
  return lines.join('\n');
}

function coneTable(cones: readonly ConeLoad[]): string {
  const lines = [
    'A cone is the package plus every transitive workspace dependent. A source change misses this CPU. The wall clock is the longest task in the cone when the runner has the slots below, because dependents wait on `src`, and `src` is not the long task.',
    '',
    '| Package | Packages | CPU | Longest task |',
    '| --- | --- | --- | --- |',
  ];
  for (const cone of cones)
    lines.push(
      `| ${cone.name} | ${String(cone.packages)} | ${seconds(cone.seconds)} | ${cone.poleTask} ${seconds(cone.poleSeconds)} |`
    );
  return lines.join('\n');
}

function fitTable(fit: RunnerFit): string {
  return [
    `Work budget ${String(WORK_BUDGET_SECONDS)} s. Warm start ${String(WARM_START_SECONDS)} s. Verdict slack ${String(SLACK_SECONDS)} s. Spec workers stay at or under ${String(SPEC_WORKER_CAP)}.`,
    '',
    '| | |',
    '| --- | --- |',
    row('Spec slots', String(fit.specSlots)),
    row('Other slots', String(fit.otherSlots)),
    row('Cores required', String(fit.cores)),
    row('Memory required', `${String(fit.memoryGib)} GiB`),
    row('Estimated makespan', seconds(fit.makespanSeconds)),
    row(
      'Provision',
      `${String(RUNNER_COUNT)} × ${String(RUNNER_VCPU)} vCPU, ${String(RUNNER_RAM_GIB)} GB, Linux x64`
    ),
    row('Fits', fit.fits ? 'yes' : 'no'),
  ].join('\n');
}

function row(label: string, value: string): string {
  return `| ${label} | ${value} |`;
}

function seconds(value: number): string {
  return `${String(value)} s`;
}

export function measuredSection(doc: string): string {
  const start = doc.indexOf(START);
  const end = doc.indexOf(END);
  if (start < 0 || end < start)
    throw new Error('CI requirements doc is missing ci-load markers');
  return doc.slice(start + START.length, end).trim();
}

export function replaceMeasuredLoad(doc: string, section: string): string {
  const start = doc.indexOf(START);
  const end = doc.indexOf(END);
  if (start < 0 || end < start)
    throw new Error('CI requirements doc is missing ci-load markers');
  return `${doc.slice(0, start + START.length)}\n${section.trim()}\n${doc.slice(end)}`;
}

export function readLoadInput(root: string): LoadInput {
  const packages = TIERS.flatMap((tier) => readTier(join(root, tier)));
  const costs = JSON.parse(
    readFileSync(join(root, 'libs/tools/scripts/check-task-costs.json'), 'utf8')
  ) as Record<string, number>;
  return { packages, costs };
}

function readTier(dir: string): PackageWork[] {
  return readdirSync(dir).flatMap((name) => {
    const work = readPackage(join(dir, name, 'package.json'));
    return work ? [work] : [];
  });
}

function readPackage(path: string): PackageWork | null {
  let pkg: {
    name?: unknown;
    scripts?: unknown;
    dependencies?: unknown;
    devDependencies?: unknown;
    optionalDependencies?: unknown;
  };
  try {
    pkg = JSON.parse(readFileSync(path, 'utf8')) as typeof pkg;
  } catch {
    return null;
  }
  if (typeof pkg.name !== 'string') return null;
  const scripts = pkg.scripts;
  const names =
    typeof scripts === 'object' && scripts !== null
      ? Object.keys(scripts).filter(isCheckTask)
      : [];
  return { name: pkg.name, dependencies: workspaceDeps(pkg), tasks: names };
}

function workspaceDeps(pkg: Record<string, unknown>): string[] {
  const deps: string[] = [];
  for (const field of DEP_FIELDS) {
    const table = pkg[field];
    if (typeof table !== 'object' || table === null) continue;
    for (const [name, spec] of Object.entries(table))
      if (typeof spec === 'string' && spec.startsWith('workspace:'))
        deps.push(name);
  }
  return deps;
}

if (import.meta.main) {
  const root = join(import.meta.dirname, '../../..');
  const section = renderMeasuredLoad(loadReport(readLoadInput(root)));
  const path = join(root, 'docs/CI_REQUIREMENTS.md');
  if (process.argv[2] === '--write') {
    writeFileSync(
      path,
      replaceMeasuredLoad(readFileSync(path, 'utf8'), section)
    );
    console.log(`ci-load: wrote ${path}`);
  } else {
    console.log(section);
  }
}
