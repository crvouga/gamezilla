/**
 * How `test-spec.ts` splits one package's spec suite. Pure: the split depends
 * only on spec files and their owner-generated variant plans, so every part of one suite — each on its own CI
 * shard — computes the same assignment, and every scenario and trace runs in
 * exactly one part.
 *
 * Two levels. A spec becomes one or more *units* — test files — because
 * `bun test --parallel` spreads files over workers but runs one file's tests
 * in order: a long feature is sliced into files of ~{@link SLICE_SCENARIOS}
 * scenarios, a Quint model into {@link MODEL_SLICES} files of traces. Then
 * `--part k/n` takes its share of the units. Every other spec kind — a DMN
 * decision table, an Alloy structure, an OpenSLO objective — checks in one
 * file and is one unit of {@link VERIFY_WEIGHT}.
 *
 * A model its package plans (`tests/quint/replays.json`, see
 * `model-replays.ts`) is sized by the replays its tests run — every variant's,
 * in each check profile — rather than by a fixed count of drawn traces.
 */

import type { ReplayPlan } from '@pkgs/quint-server-ts/trace-runs';
import { sliceReplays } from '@pkgs/quint-server-ts/trace-runs';

export type Part = { readonly index: number; readonly count: number };
export type Slice = { readonly index: number; readonly count: number };

/** One test file: a spec, or one slice of it. */
export type SpecUnit = {
  readonly path: string;
  readonly slice?: Slice | undefined;
  readonly weight: number;
  /** Exact feature expansion, projected from the owning suite's registry. */
  readonly variants?: number;
  /** A planned model file's trace replays in each check profile. */
  readonly replays?: ModelReplays | undefined;
};

/** Trace replays under the pull-request gate and under the nightly run. */
export type ModelReplays = { readonly pr: number; readonly nightly: number };

/** Scenarios per feature slice. */
export const SLICE_SCENARIOS = 6;
/** Minimum files one Quint model's traces are spread over. */
export const MODEL_SLICES = 8;

/**
 * Expected cost of a spec in scenario units, from the spec text alone: a
 * feature's scenarios plus each outline's example rows; a Quint model replays
 * 64 whole-world traces, measured at roughly two scenarios per trace.
 */
export const MODEL_WEIGHT = 128;
/** A decision table, structure or objective: one static check, one unit. */
export const VERIFY_WEIGHT = 1;
/** Scenario units one replayed whole-world trace costs (as in MODEL_WEIGHT). */
export const TRACE_WEIGHT = 2;
/** Most pull-request replays one planned model file holds: they run in order. */
export const MODEL_FILE_REPLAYS = 4;
/**
 * The nightly profile's per-task budget over the gate's (`taskBudgetScale`
 * in `libs/tools-harness-ts/scripts/verify-profile.ts`): a part may replay this many
 * times its gate load when the run explores.
 */
export const NIGHTLY_REPLAY_SCALE = 4;
/** Most files one planned model is spread over. */
const MAX_MODEL_FILES = 64;
/**
 * Most pull-request replays one part runs: a part of twelve took at most
 * 332 s on the 2-core runner replaying every one (Verify run 38187450396), so
 * sixteen stay near 443 s inside the 600 s cap; twenty was the miss. A
 * nightly part may run {@link NIGHTLY_REPLAY_SCALE} times as many.
 */
export const PART_REPLAYS = 16;
/**
 * Most scenario units per planned part. A 50-unit shared-game part took
 * 360 seconds on Verify run 39467547837. Thirty keeps the same scenarios
 * and replays in smaller tasks, leaving startup and verdict time inside
 * the unchanged five-minute target. Every planned suite uses this cap.
 */
export const PART_LOAD = 30;

function isFeature(path: string): boolean {
  return path.endsWith('.feature');
}

export function specWeight(path: string, source: string): number {
  if (path.endsWith('.qnt')) return MODEL_WEIGHT;
  if (!isFeature(path)) return VERIFY_WEIGHT;
  let weight = 0;
  let inExamples = false;
  let headerSeen = false;
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (/^(Scenario|Example):/.test(line)) {
      weight++;
      inExamples = false;
    } else if (/^(Scenario Outline|Scenario Template):/.test(line)) {
      inExamples = false;
    } else if (/^(Examples|Scenarios):/.test(line)) {
      inExamples = true;
      headerSeen = false;
    } else if (inExamples && line.startsWith('|')) {
      if (headerSeen) weight++;
      headerSeen = true;
    } else if (line !== '' && !line.startsWith('#') && !line.startsWith('@')) {
      inExamples = false;
    }
  }
  return Math.max(1, weight);
}

/**
 * The test files one spec runs as, each weighed. Large suites need smaller
 * model files so traces can spread over the suite's independently cached parts.
 */
export function specUnits(
  path: string,
  source: string,
  partCount = 1,
  plan?: ReplayPlan | null
): readonly SpecUnit[] {
  if (path.endsWith('.qnt') && plan !== undefined && plan !== null)
    return plannedModelUnits(path, plan);
  const weight = specWeight(path, source);
  if (!isFeature(path) && !path.endsWith('.qnt')) return [{ path, weight }];
  const count = path.endsWith('.qnt')
    ? Math.max(
        MODEL_SLICES,
        2 ** Math.floor(Math.log2(Math.max(1, partCount / 2)))
      )
    : Math.ceil(weight / SLICE_SCENARIOS);
  if (count <= 1) return [{ path, weight }];
  return Array.from({ length: count }, (_, index) => ({
    path,
    slice: { index, count },
    weight: path.endsWith('.qnt')
      ? 2 * (Math.floor(64 / count) + (index < 64 % count ? 1 : 0))
      : weight / count,
  }));
}

/**
 * A planned model's files: the fewest whose every file holds at most
 * {@link MODEL_FILE_REPLAYS} gate replays, each weighed by the heavier of its
 * gate load and its nightly load over the nightly budget.
 */
export function plannedModelUnits(
  path: string,
  plan: ReplayPlan
): readonly SpecUnit[] {
  const count = plannedModelFiles(plan);
  return Array.from({ length: count }, (_, index) => {
    const slice = { index, count };
    const replays = {
      pr: sliceReplays(plan, 'pr', slice),
      nightly: sliceReplays(plan, 'nightly', slice),
    };
    return {
      path,
      ...(count === 1 ? {} : { slice }),
      weight:
        TRACE_WEIGHT *
        Math.max(replays.pr, replays.nightly / NIGHTLY_REPLAY_SCALE),
      replays,
    };
  });
}

/**
 * The fewest files whose gate replays each stay within MODEL_FILE_REPLAYS and
 * whose nightly replays each fit one part: a model that draws far more traces
 * than it covers replays them all nightly, which one file cannot hold.
 */
function plannedModelFiles(plan: ReplayPlan): number {
  const heaviest = (profile: 'pr' | 'nightly', count: number) =>
    Math.max(
      ...Array.from({ length: count }, (_, index) =>
        sliceReplays(plan, profile, { index, count })
      )
    );
  for (let count = 1; count < MAX_MODEL_FILES; count++) {
    if (
      heaviest('pr', count) <= MODEL_FILE_REPLAYS &&
      heaviest('nightly', count) <= PART_REPLAYS * NIGHTLY_REPLAY_SCALE
    )
      return count;
  }
  return MAX_MODEL_FILES;
}

/** A part's scenario units and its trace replays in each check profile. */
export function partLoad(units: readonly SpecUnit[]): {
  readonly load: number;
  readonly pr: number;
  readonly nightly: number;
} {
  let load = 0;
  let pr = 0;
  let nightly = 0;
  for (const unit of units) {
    if (unit.replays === undefined) {
      load += unit.weight;
      continue;
    }
    pr += unit.replays.pr;
    nightly += unit.replays.nightly;
  }
  return { load: load + TRACE_WEIGHT * pr, pr, nightly };
}

function unitKey(unit: SpecUnit): string {
  return `${unit.path}#${String(unit.slice?.index ?? 0)}`;
}

type PartLoad = { load: number; units: SpecUnit[] };

/**
 * Quint batches keep their bounded, balanced allocation and fill otherwise
 * empty hashed parts. Other specs keep stable path ownership when another
 * feature changes. Suites with a feature variant plan bound the expanded
 * load and move a hashed unit only when its owner is full. Part 0 also owns
 * `tests/harness`.
 */
export function partOf(
  units: readonly SpecUnit[],
  part: Part
): readonly SpecUnit[] {
  return partsOf(units, part.count)[part.index] ?? [];
}

/** Compute the complete immutable assignment once, in part-index order. */
export function partsOf(
  units: readonly SpecUnit[],
  count: number
): readonly (readonly SpecUnit[])[] {
  if (units.some((unit) => unit.variants !== undefined))
    return boundedSpecParts(units, count);
  const loads: PartLoad[] = Array.from({ length: count }, (_, index) => ({
    load: index === 0 ? 1 : 0,
    units: [],
  }));
  const models: SpecUnit[] = [];
  const rest: SpecUnit[] = [];
  for (const unit of units) {
    if (unit.path.endsWith('.qnt')) models.push(unit);
    else rest.push(unit);
  }
  placeOnLightest(loads, models);
  for (const unit of rest) {
    const index = specOwner(unit.path, count, unit.slice?.index ?? 0);
    loads[index]!.units.push(unit);
  }
  fillEmptyParts(loads);
  return Object.freeze(
    loads.map((part) =>
      Object.freeze(
        part.units.sort((a, b) => unitKey(a).localeCompare(unitKey(b)))
      )
    )
  );
}

/** Fill sparse path-hash gaps without increasing an existing part's load. */
function fillEmptyParts(loads: readonly PartLoad[]): void {
  for (const empty of loads) {
    if (empty.units.length > 0) continue;
    const donor = [...loads]
      .filter(
        (candidate) =>
          candidate.units.length > 1 &&
          candidate.units.some((unit) => unit.path.endsWith('.qnt'))
      )
      .sort((a, b) => b.load - a.load)[0];
    if (donor === undefined) continue;
    const index = donor.units.findLastIndex((unit) =>
      unit.path.endsWith('.qnt')
    );
    const [unit] = donor.units.splice(index, 1);
    if (unit !== undefined) {
      donor.load -= unit.weight;
      empty.units.push(unit);
      empty.load += unit.weight;
    }
  }
}

/** Feature paths keep their owner when another feature changes. */
export function specOwner(path: string, count: number, slice = 0): number {
  const key = path.replaceAll('\\', '/').replace(/^(?:.*\/)?specs\//, '');
  let hash = 2166136261;
  for (const character of key) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return ((hash % count) + slice) % count;
}

/** Longest processing time onto the lightest part; ties break by unit key. */
function placeOnLightest(
  loads: readonly PartLoad[],
  units: readonly SpecUnit[]
): void {
  const ordered = [...units].sort(
    (a, b) => b.weight - a.weight || unitKey(a).localeCompare(unitKey(b))
  );
  for (const unit of ordered) {
    let lightest = loads[0] as PartLoad;
    for (const candidate of loads)
      if (candidate.load < lightest.load) lightest = candidate;
    lightest.units.push(unit);
    lightest.load += unit.weight;
  }
}

export type ModelDraw = {
  readonly path: string;
  readonly traces: number;
  readonly maxSteps: number;
};

/** Two bounded workers prepare the same draws, with the largest work first. */
export function modelDrawBatches(
  draws: readonly ModelDraw[]
): readonly (readonly ModelDraw[])[] {
  const batches: { cost: number; draws: ModelDraw[] }[] = [
    { cost: 0, draws: [] },
    { cost: 0, draws: [] },
  ];
  const cost = (draw: ModelDraw) => draw.traces * draw.maxSteps;
  for (const draw of [...draws].sort((a, b) => cost(b) - cost(a))) {
    const batch =
      batches[0]!.cost <= batches[1]!.cost ? batches[0]! : batches[1]!;
    batch.draws.push(draw);
    batch.cost += cost(draw);
  }
  return batches
    .map((batch) => batch.draws)
    .filter((batch) => batch.length > 0);
}

/** Variant-aware suites retain a hash owner unless that part is already full. */
function boundedSpecParts(
  units: readonly SpecUnit[],
  count: number
): readonly (readonly SpecUnit[])[] {
  const parts: SpecUnit[][] = Array.from({ length: count }, () => []);
  const loads = parts.map(() => ({ load: 0, pr: 0, nightly: 0 }));
  const ordered = [...units].sort(
    (a, b) =>
      b.weight - a.weight ||
      comparePaths(a.path, b.path) ||
      (a.slice?.index ?? 0) - (b.slice?.index ?? 0)
  );
  for (const unit of ordered) {
    const cost = partLoad([unit]);
    const owner = specOwner(unit.path, count, unit.slice?.index ?? 0);
    const index = boundedOwner(loads, owner, cost);
    parts[index]!.push(unit);
    const load = loads[index]!;
    load.load += cost.load;
    load.pr += cost.pr;
    load.nightly += cost.nightly;
  }
  return Object.freeze(
    parts.map((part) =>
      Object.freeze(part.sort((a, b) => comparePaths(unitKey(a), unitKey(b))))
    )
  );
}

/** Assignment must not depend on the runner's locale or ICU version. */
function comparePaths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Accumulate costs once; candidate searches never rescan already placed files. */
function boundedOwner(
  loads: readonly ReturnType<typeof partLoad>[],
  owner: number,
  cost: ReturnType<typeof partLoad>
): number {
  let lightest = owner;
  for (let offset = 0; offset < loads.length; offset++) {
    const index = (owner + offset) % loads.length;
    const load = loads[index]!;
    if (
      load.load + cost.load <= PART_LOAD &&
      load.pr + cost.pr <= PART_REPLAYS &&
      load.nightly + cost.nightly <= PART_REPLAYS * NIGHTLY_REPLAY_SCALE
    )
      return index;
    if (load.load < loads[lightest]!.load) lightest = index;
  }
  // An undersized candidate still returns every unit, so the planning gate
  // can reject its overfull parts while finding the minimum supported count.
  return lightest;
}
