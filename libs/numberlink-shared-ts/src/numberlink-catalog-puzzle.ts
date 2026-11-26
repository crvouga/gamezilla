import type { BundledPuzzle } from '@pkgs/turn-game-shared-ts/puzzle-content';
import {
  type NumberlinkNotation,
  parseNumberlinkNotation,
} from './numberlink-notation';
import type { Cell } from './numberlink-types';

/** One catalog entry as the JSON carries it. */
export type CatalogEntry = {
  readonly id: string;
  readonly board: string;
  readonly solution: string;
};

/** Each pair's path, walked from its first endpoint through cells carrying its letter. */
function solvedPaths(notation: NumberlinkNotation, solution: string): Cell[][] {
  const rows = solution.split('/');
  const letter = (cell: Cell): string | undefined => rows[cell.y]?.[cell.x];
  return notation.pairs.map((pair) => {
    const [start, end] = pair.endpoints;
    const cells: Cell[] = [start];
    const seen = new Set([`${start.x},${start.y}`]);
    for (let at = start; at.x !== end.x || at.y !== end.y; ) {
      const next = [
        { x: at.x + 1, y: at.y },
        { x: at.x - 1, y: at.y },
        { x: at.x, y: at.y + 1 },
        { x: at.x, y: at.y - 1 },
      ].filter(
        (cell) =>
          letter(cell) === pair.letter && !seen.has(`${cell.x},${cell.y}`)
      );
      // A path that touches itself has no single reading; the witness stops.
      if (next.length !== 1) break;
      at = next[0]!;
      seen.add(`${at.x},${at.y}`);
      cells.push(at);
    }
    return cells;
  });
}

/**
 * A shipped puzzle adapted from one compact catalog entry. The witness is
 * expanded from the solved board only when something asks for it, so
 * importing the catalog never builds hundreds of path lists.
 */
export class CatalogPuzzle implements BundledPuzzle {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: string;
  readonly definition: string;
  readonly #solution: string;
  #witness: readonly string[] | undefined;

  constructor(
    pack: {
      readonly id: string;
      readonly title: string;
      readonly difficulty: string;
    },
    entry: CatalogEntry
  ) {
    this.id = `${pack.id}-${entry.id}`;
    this.title = `${pack.title} ${Number(entry.id)}`;
    this.difficulty = pack.difficulty;
    this.definition = entry.board;
    this.#solution = entry.solution;
    this.description = describe(entry.board);
  }

  get witness(): readonly string[] {
    this.#witness ??= witnessOf(this.definition, this.#solution);
    return this.#witness;
  }
}

function describe(board: string): string {
  const notation = parseNumberlinkNotation(board);
  if (!notation.valid) return '';
  const { width, height, pairs, records } = notation.value;
  const rule =
    records.length > 0
      ? 'Join every pair; cells may stay empty.'
      : 'Join every pair and fill every cell.';
  return `${width} by ${height} board with ${pairs.length} pairs. ${rule}`;
}

/** One accepted action per pair, in letter order. */
export function witnessOf(board: string, solution: string): readonly string[] {
  const notation = parseNumberlinkNotation(board);
  if (!notation.valid) return [];
  return solvedPaths(notation.value, solution).map((cells, index) =>
    JSON.stringify({ pairId: notation.value.pairs[index]!.letter, cells })
  );
}
