/** One share of a split proof: phase indexes inside a fixed count. */
export type PhaseArg = {
  readonly indexes: readonly number[];
  readonly count: number;
};

const PHASE_ARG = /^(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)\/(\d+)$/;
const PHASE_TOKEN = /^(\d+)(?:-(\d+))?$/;

/**
 * `4/12` or `0-3,5-11/12`. An empty list, a duplicate, an inverted range,
 * or an index outside the count is refused.
 */
export function parsePhaseArg(text: string): PhaseArg | null {
  const match = PHASE_ARG.exec(text);
  if (match === null) return null;
  const count = Number(match[2]);
  const indexes = expandPhaseIndexes(match[1] ?? '');
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    indexes === null ||
    indexes.some((index) => index >= count)
  )
    return null;
  return { indexes, count };
}

/** Canonical form: indexes sorted, neighbours collapsed into ranges. */
export function formatPhaseArg(
  indexes: readonly number[],
  count: number
): string {
  const sorted = [...indexes].sort((left, right) => left - right);
  return `${formatPhaseIndexes(sorted)}/${String(count)}`;
}

function expandPhaseIndexes(text: string): readonly number[] | null {
  const indexes: number[] = [];
  for (const token of text.split(',')) {
    const match = PHASE_TOKEN.exec(token);
    if (match === null) return null;
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (end < start) return null;
    for (let index = start; index <= end; index += 1) indexes.push(index);
  }
  if (indexes.length === 0 || new Set(indexes).size !== indexes.length)
    return null;
  return indexes;
}

function formatPhaseIndexes(indexes: readonly number[]): string {
  const ranges: string[] = [];
  let start = indexes[0];
  let previous = indexes[0];
  if (start === undefined || previous === undefined) return '';
  for (const index of indexes.slice(1)) {
    if (index === previous + 1) {
      previous = index;
      continue;
    }
    ranges.push(phaseRange(start, previous));
    start = index;
    previous = index;
  }
  ranges.push(phaseRange(start, previous));
  return ranges.join(',');
}

function phaseRange(start: number, end: number): string {
  return start === end ? String(start) : `${String(start)}-${String(end)}`;
}
