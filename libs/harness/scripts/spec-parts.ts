/**
 * How `test-spec.ts` splits one package's spec suite. Pure: the split depends
 * only on the spec files, so every part of one suite — each on its own CI
 * shard — computes the same assignment, and every scenario and trace runs in
 * exactly one part.
 *
 * Two levels. A spec becomes one or more *units* — test files — because
 * `bun test --parallel` spreads files over workers but runs one file's tests
 * in order: a long feature is sliced into files of ~{@link SLICE_SCENARIOS}
 * scenarios, a Quint model into {@link MODEL_SLICES} files of traces. Then
 * `--part k/n` takes its share of the units. Every other spec kind — a DMN
 * decision table, an Alloy structure, an OpenSLO objective — checks in one
 * file and is one unit of {@link CHECK_WEIGHT}.
 */

export type Part = { readonly index: number; readonly count: number };
export type Slice = { readonly index: number; readonly count: number };

/** One test file: a spec, or one slice of it. */
export type SpecUnit = {
  readonly path: string;
  readonly slice?: Slice | undefined;
  readonly weight: number;
};

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
export const CHECK_WEIGHT = 1;

function isFeature(path: string): boolean {
  return path.endsWith('.feature');
}

export function specWeight(path: string, source: string): number {
  if (path.endsWith('.qnt')) return MODEL_WEIGHT;
  if (!isFeature(path)) return CHECK_WEIGHT;
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
  partCount = 1
): readonly SpecUnit[] {
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

function unitKey(unit: SpecUnit): string {
  return `${unit.path}#${String(unit.slice?.index ?? 0)}`;
}

type PartLoad = { load: number; units: SpecUnit[] };

/**
 * Quint batches keep their bounded, balanced allocation. Other specs have
 * stable path ownership: editing one feature never moves another feature or
 * a model batch. Part 0 also owns `tests/harness`.
 */
export function partOf(
  units: readonly SpecUnit[],
  part: Part
): readonly SpecUnit[] {
  const loads: PartLoad[] = Array.from({ length: part.count }, (_, index) => ({
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
    const index = specOwner(unit.path, part.count, unit.slice?.index ?? 0);
    loads[index]!.units.push(unit);
  }
  return (loads[part.index]?.units ?? []).sort((a, b) =>
    unitKey(a).localeCompare(unitKey(b))
  );
}

/** Feature edits cannot move unrelated features or the bounded model batches. */
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
