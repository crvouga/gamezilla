import type { PlacedLetter, ProposedTile } from './word-tiles-action';
import { BOARD_SIZE, CENTER_CELL, cellAt } from './word-tiles-board';
import {
  boardIsEmpty,
  type Direction,
  isOccupied,
  scoreGeneratedLine,
} from './word-tiles-placement';
import { BLANK, tileOf } from './word-tiles-tiles';
import { ROOT_NODE, type WordTrie } from './word-tiles-trie';

/**
 * Every placement a rack allows on a board, found the way word-game
 * engines do: from each anchor (an empty cell touching the board, or the
 * centre of an empty board) a left part from the rack, then extended right
 * through the trie, honouring each cell's cross-check (the letters that keep
 * its perpendicular word in the word list), the rack's multiplicities and
 * every letter a blank may play. Each found placement is scored by the
 * same word scorer used by the authority. The search is bounded by `budget` trie
 * steps, deterministic, and reports whether it finished.
 */

export type GeneratedMove = {
  readonly tiles: readonly ProposedTile[];
  readonly placed: readonly PlacedLetter[];
  readonly score: number;
};

export type MoveSearch = {
  readonly moves: readonly GeneratedMove[];
  /** `false` when a search limit stopped exploration. */
  readonly complete: boolean;
};

type RackTiles = {
  /** Unused tile ids by letter index 0–25. */
  readonly byLetter: number[][];
  readonly blanks: number[];
};

type Line = {
  readonly direction: Direction;
  /** Cells of the row (across) or column (down), in order. */
  readonly cells: readonly number[];
  /** Per index: the letters allowed by its cross word, or `null` for any. */
  readonly allowed: readonly (ReadonlySet<number> | null)[];
};

type Search = {
  readonly board: string;
  readonly trie: WordTrie;
  readonly rack: RackTiles;
  readonly anchors: ReadonlySet<number>;
  readonly found: Map<string, GeneratedMove>;
  remainingSteps: number;
  readonly maxMoves: number;
};

function letterIndex(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

function rackTiles(rack: readonly number[]): RackTiles {
  const byLetter: number[][] = Array.from({ length: 26 }, () => []);
  const blanks: number[] = [];
  for (const id of rack) {
    const tile = tileOf(id);
    if (tile === null) continue;
    if (tile.symbol === BLANK) blanks.push(id);
    else byLetter[letterIndex(tile.symbol)]!.push(id);
  }
  return { byLetter, blanks };
}

/** The trie node of `letters` from the root, or `-1`. */
function walk(trie: WordTrie, letters: string, from = ROOT_NODE): number {
  let node = from;
  for (const letter of letters) {
    if (node === -1) return -1;
    node = trie.child(node, letterIndex(letter));
  }
  return node;
}

function runLetters(board: string, cells: readonly number[]): string {
  return cells.map((cell) => board[cell]!.toUpperCase()).join('');
}

/** Letters `L` such that the perpendicular word through `cell` with `L` is a word. */
function crossCheck(
  search: Pick<Search, 'board' | 'trie'>,
  cell: number,
  step: readonly [number, number]
): ReadonlySet<number> | null {
  const { board, trie } = search;
  const row = Math.floor(cell / BOARD_SIZE);
  const column = cell % BOARD_SIZE;
  const run = (sign: number): number[] => {
    const cells: number[] = [];
    for (let n = 1; ; n++) {
      const c = cellAt(row + step[0] * n * sign, column + step[1] * n * sign);
      if (c === null || !isOccupied(board, c)) return cells;
      cells.push(c);
    }
  };
  const before = run(-1).reverse();
  const after = run(1);
  if (before.length === 0 && after.length === 0) return null;
  const prefix = walk(trie, runLetters(board, before));
  const allowed = new Set<number>();
  if (prefix === -1) return allowed;
  const suffix = runLetters(board, after);
  trie.forEachChild(prefix, (letter, child) => {
    const end = walk(trie, suffix, child);
    if (end !== -1 && trie.terminal(end)) allowed.add(letter);
  });
  return allowed;
}

/** Rows first, then columns, in the order the bounded search visits them. */
const BOARD_LINES = (['across', 'down'] as const).flatMap((direction) =>
  Array.from({ length: BOARD_SIZE }, (_, line) => ({
    direction,
    cells: Array.from({ length: BOARD_SIZE }, (_, i) =>
      direction === 'across' ? line * BOARD_SIZE + i : i * BOARD_SIZE + line
    ),
  }))
);

function searchLines(search: Search): void {
  for (const { direction, cells } of BOARD_LINES) {
    if (search.remainingSteps <= 0) return;
    if (!cells.some((cell) => search.anchors.has(cell))) continue;
    const perpendicular: readonly [number, number] =
      direction === 'across' ? [1, 0] : [0, 1];
    const line: Line = {
      direction,
      cells,
      allowed: cells.map((cell) =>
        isOccupied(search.board, cell)
          ? null
          : crossCheck(search, cell, perpendicular)
      ),
    };
    for (const [index, cell] of cells.entries()) {
      if (search.remainingSteps <= 0) return;
      if (search.anchors.has(cell)) searchAnchor(search, line, index);
    }
  }
}

function isAnchor(board: string, cell: number): boolean {
  if (isOccupied(board, cell)) return false;
  const row = Math.floor(cell / BOARD_SIZE);
  const column = cell % BOARD_SIZE;
  return [
    cellAt(row - 1, column),
    cellAt(row + 1, column),
    cellAt(row, column - 1),
    cellAt(row, column + 1),
  ].some((c) => c !== null && isOccupied(board, c));
}

type Path = {
  readonly line: Line;
  readonly tiles: ProposedTile[];
  node: number;
  index: number;
  readonly anchor: number;
};

function record(search: Search, path: Path): void {
  const { tiles } = path;
  const placed = tiles.map(
    (t): PlacedLetter => ({
      cell: t.cell,
      letter: t.assigned ?? tileOf(t.tile)!.symbol,
      blank: t.assigned !== null,
    })
  );
  const key = placed
    .map((p) => `${p.cell}${p.blank ? p.letter.toLowerCase() : p.letter}`)
    .join('.');
  if (search.found.has(key)) return;
  // The trie accepted the full line and every perpendicular word.
  const evaluation = scoreGeneratedLine(
    search.board,
    placed,
    path.line.direction
  );
  if (!evaluation.ok) return;
  search.found.set(key, {
    tiles: [...tiles],
    placed,
    score: evaluation.score.total,
  });
  if (search.found.size >= search.maxMoves) search.remainingSteps = 0;
}

function canSpend(rack: RackTiles, letter: number): boolean {
  return rack.byLetter[letter]!.length > 0 || rack.blanks.length > 0;
}

/** Visit each way to play `letter`: a real tile, then a blank. */
function spend(
  rack: RackTiles,
  letter: number,
  visit: (use: { readonly tile: number; readonly blank: boolean }) => void
): void {
  const real = rack.byLetter[letter]!;
  if (real.length > 0) {
    const tile = real.pop()!;
    visit({ tile, blank: false });
    real.push(tile);
  }
  if (rack.blanks.length > 0) {
    const tile = rack.blanks.pop()!;
    visit({ tile, blank: true });
    rack.blanks.push(tile);
  }
}

function placeAt(
  path: Path,
  letter: number,
  use: { readonly tile: number; readonly blank: boolean }
): ProposedTile {
  return {
    cell: path.line.cells[path.index]!,
    tile: use.tile,
    assigned: use.blank ? String.fromCharCode(65 + letter) : null,
  };
}

function extendThrough(search: Search, path: Path, node: number): void {
  const previousNode = path.node;
  path.node = node;
  path.index += 1;
  extendRight(search, path);
  path.index -= 1;
  path.node = previousNode;
}

function extendRight(search: Search, path: Path): void {
  if (search.remainingSteps-- <= 0) return;
  const { line, index, node } = path;
  const cell = line.cells[index];
  const filled = cell !== undefined && isOccupied(search.board, cell);
  if (
    !filled &&
    index > path.anchor &&
    path.tiles.length > 0 &&
    search.trie.terminal(node)
  )
    record(search, path);
  if (cell === undefined) return;
  if (filled) {
    const next = search.trie.child(node, letterIndex(search.board[cell]!));
    if (next !== -1) extendThrough(search, path, next);
    return;
  }
  const allowed = line.allowed[index];
  search.trie.forEachChild(node, (letter, child) => {
    if (!canSpend(search.rack, letter)) return;
    if (allowed !== null && allowed !== undefined && !allowed.has(letter))
      return;
    spend(search.rack, letter, (use) => {
      path.tiles.push(placeAt(path, letter, use));
      extendThrough(search, path, child);
      path.tiles.pop();
    });
  });
}

type Spent = {
  readonly letter: number;
  readonly use: { readonly tile: number; readonly blank: boolean };
};

/**
 * Left parts grow at their end and always finish just before the anchor,
 * on empty cells that touch nothing (so no cross word limits them).
 */
function leftPart(
  search: Search,
  at: { readonly line: Line; readonly anchor: number; readonly node: number },
  partial: readonly Spent[],
  limit: number
): void {
  if (search.remainingSteps-- <= 0) return;
  const { line, anchor, node } = at;
  const tiles = partial.map((p, i) =>
    placeAt(
      { line, tiles: [], node, anchor, index: anchor - partial.length + i },
      p.letter,
      p.use
    )
  );
  extendRight(search, { line, tiles, node, index: anchor, anchor });
  if (limit === 0) return;
  search.trie.forEachChild(node, (letter, child) => {
    if (!canSpend(search.rack, letter)) return;
    spend(search.rack, letter, (use) =>
      leftPart(
        search,
        { ...at, node: child },
        [...partial, { letter, use }],
        limit - 1
      )
    );
  });
}

function searchAnchor(search: Search, line: Line, anchor: number): void {
  const { board } = search;
  const left = line.cells[anchor - 1];
  if (left !== undefined && isOccupied(board, left)) {
    let start = anchor - 1;
    while (start > 0 && isOccupied(board, line.cells[start - 1]!)) start--;
    const prefix = runLetters(board, line.cells.slice(start, anchor));
    const node = walk(search.trie, prefix);
    if (node !== -1)
      extendRight(search, { line, tiles: [], node, index: anchor, anchor });
    return;
  }
  let limit = 0;
  while (
    anchor - limit - 1 >= 0 &&
    !isOccupied(board, line.cells[anchor - limit - 1]!) &&
    !search.anchors.has(line.cells[anchor - limit - 1]!)
  )
    limit++;
  leftPart(search, { line, anchor, node: ROOT_NODE }, [], limit);
}

/** Every placement `rack` allows on `board` within `budget` trie steps. */
export function generateMoves(input: {
  readonly board: string;
  readonly rack: readonly number[];
  readonly trie: WordTrie;
  readonly budget: number;
  /** Stop once this many distinct placements have been found. */
  readonly maxMoves?: number;
}): MoveSearch {
  const maxMoves = input.maxMoves ?? Number.POSITIVE_INFINITY;
  if (!(input.budget > 0 && maxMoves > 0))
    return { moves: [], complete: false };
  const search: Search = {
    board: input.board,
    trie: input.trie,
    rack: rackTiles(input.rack),
    anchors: new Set(
      boardIsEmpty(input.board)
        ? [CENTER_CELL]
        : Array.from({ length: input.board.length }, (_, cell) => cell).filter(
            (cell) => isAnchor(input.board, cell)
          )
    ),
    found: new Map(),
    remainingSteps: input.budget,
    maxMoves,
  };
  searchLines(search);
  return {
    moves: [...search.found.values()],
    complete: search.remainingSteps > 0,
  };
}
