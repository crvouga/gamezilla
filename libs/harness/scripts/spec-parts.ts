/**
 * How `test-spec.ts --part k/n` splits one package's spec suite. Pure: the
 * split depends only on the spec files, so every part of one suite — each on
 * its own CI shard — computes the same assignment, and every spec runs in
 * exactly one part.
 */

export type Part = { readonly index: number; readonly count: number };

/**
 * Expected cost of a spec in scenario units, from the spec text alone: a
 * feature's scenarios plus each outline's example rows; a Quint model replays
 * several whole-world traces in one file, measured at ~25 scenarios.
 */
export const MODEL_WEIGHT = 25;

export function specWeight(path: string, source: string): number {
  if (path.endsWith('.qnt')) return MODEL_WEIGHT;
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
 * The specs of part `part.index`: longest-processing-time first over
 * {@link specWeight}, ties by path, so the split is a pure function of the
 * specs. Part 0 also runs `tests/harness`, so it starts one unit heavier.
 */
export function partOf(
  specs: readonly { readonly path: string; readonly weight: number }[],
  part: Part
): readonly string[] {
  const loads = Array.from({ length: part.count }, (_, index) => ({
    load: index === 0 ? 1 : 0,
    paths: [] as string[],
  }));
  const ordered = [...specs].sort(
    (a, b) => b.weight - a.weight || a.path.localeCompare(b.path)
  );
  for (const spec of ordered) {
    let lightest = loads[0] as (typeof loads)[number];
    for (const candidate of loads)
      if (candidate.load < lightest.load) lightest = candidate;
    lightest.paths.push(spec.path);
    lightest.load += spec.weight;
  }
  return (loads[part.index]?.paths ?? []).sort();
}
