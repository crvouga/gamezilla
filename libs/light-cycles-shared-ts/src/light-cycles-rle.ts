/** Trail marks are digits, so runs spell them as letters to keep lengths unambiguous. */
const CELL_TOKENS: Readonly<Record<string, string>> = {
  '.': '.',
  '0': 'a',
  '1': 'b',
  '2': 'c',
  '3': 'd',
};
const TOKEN_CELLS: Readonly<Record<string, string>> = {
  '.': '.',
  a: '0',
  b: '1',
  c: '2',
  d: '3',
};

/**
 * Canonical run-length encoding of trail cells: each run is its length (omitted
 * for a single cell) followed by the cell's token, and adjacent runs always
 * differ. Exactly one encoding exists for each trail string.
 */
export function encodeTrailRuns(trails: string): string {
  let encoded = '';
  let index = 0;
  while (index < trails.length) {
    const cell = trails[index]!;
    let end = index + 1;
    while (end < trails.length && trails[end] === cell) end++;
    const length = end - index;
    const token = CELL_TOKENS[cell];
    if (token === undefined) throw new Error('unknown Light Cycles trail cell');
    encoded += length === 1 ? token : `${length}${token}`;
    index = end;
  }
  return encoded;
}

/**
 * Decodes exactly `cells` trail characters, or null for any non-canonical,
 * truncated, oversized or unknown run.
 */
export function decodeTrailRuns(encoded: string, cells: number): string | null {
  const runs: string[] = [];
  let total = 0;
  let previous = '';
  const run = /([0-9]+)?([.a-d])/y;
  while (run.lastIndex < encoded.length) {
    const match = run.exec(encoded);
    if (match === null) return null;
    const count = match[1] === undefined ? 1 : Number(match[1]);
    const cell = TOKEN_CELLS[match[2]!]!;
    if (match[1] !== undefined && (count < 2 || match[1].startsWith('0')))
      return null;
    if (cell === previous) return null;
    total += count;
    if (total > cells) return null;
    runs.push(cell.repeat(count));
    previous = cell;
  }
  return total === cells ? runs.join('') : null;
}
