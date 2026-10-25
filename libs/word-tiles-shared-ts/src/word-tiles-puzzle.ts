import type {
  PuzzleChange,
  PuzzleContent,
  PuzzleIssue,
  PuzzleSolution,
  PuzzleValidation,
} from '@pkgs/turn-game-shared-ts/puzzle-content';
import type { PlacedLetter } from './word-tiles-action';
import {
  CELL_COUNT,
  CENTER_CELL,
  cellName,
  neighbours,
  parseCell,
} from './word-tiles-board';
import { lexiconIdentity, loadedLexicon } from './word-tiles-lexicon';
import { generateMoves } from './word-tiles-moves';
import {
  boardIsEmpty,
  evaluatePlacement,
  isOccupied,
  unknownWords,
  wordCells,
} from './word-tiles-placement';
import { RULESET } from './word-tiles-ruleset';
import { BLANK, TILE_KINDS, TILES } from './word-tiles-tiles';

/**
 * One-move challenges: "use this rack to score at least N points in one
 * move". A definition pins the board, the rack, the target, the ruleset and
 * the lexicon; there is no opponent, bag, refill or turn. Each placement is
 * judged and scored against the frozen board by the game's own placement
 * rules and pinned word list, and the latest placement is the attempt: the
 * puzzle is solved exactly when one placement meets the target, so lower
 * scores never add up. The target is a threshold, not a claim of the best
 * possible score.
 *
 * Definition: `{"v":1,"ruleset","lexicon","board","rack","target"}` — the
 * board as in positions (`.`, `A`–`Z`, a blank as `a`–`z`), the rack as up
 * to seven of `A`–`Z` and `?`. Action: `play:h8=0.i8=6E`, a cell and a rack
 * index per tile (a blank's letter after it). State:
 * `{"v":1,"played","score"}`.
 */
export type WordTilesPuzzle = {
  readonly ruleset: string;
  readonly lexicon: string;
  readonly board: string;
  readonly rack: string;
  readonly target: number;
};

type Decoded<T> =
  | { readonly valid: true; readonly value: T }
  | { readonly valid: false; readonly issues: readonly PuzzleIssue[] };

const MAX_TARGET = 2_000;

function issue(code: string, message: string): Decoded<never> {
  return { valid: false, issues: [{ code, message }] };
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const raw: unknown = JSON.parse(text);
    return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function encodePuzzle(puzzle: WordTilesPuzzle): string {
  return JSON.stringify({
    v: 1,
    ruleset: puzzle.ruleset,
    lexicon: puzzle.lexicon,
    board: puzzle.board,
    rack: puzzle.rack,
    target: puzzle.target,
  });
}

/** The definition as written, before its board and words are checked (for editors and previews). */
export function readPuzzle(text: string): Decoded<WordTilesPuzzle> {
  return shapeOf(text);
}

function shapeOf(text: string): Decoded<WordTilesPuzzle> {
  const raw = parseJson(text);
  if (raw === null || raw['v'] !== 1)
    return issue('unreadable', 'This puzzle cannot be read. Start it again.');
  const { ruleset, lexicon, board, rack, target } = raw;
  if (ruleset !== RULESET.id)
    return issue(
      'ruleset',
      'This puzzle uses rules this app does not have. Update the app.'
    );
  if (typeof lexicon !== 'string' || lexiconIdentity(lexicon) === null)
    return issue(
      'lexicon-unknown',
      'This puzzle uses a word list this app does not have. Update the app.'
    );
  if (
    typeof board !== 'string' ||
    !/^[.A-Za-z]+$/.test(board) ||
    board.length !== CELL_COUNT
  )
    return issue('board', 'The board cannot be read.');
  if (typeof rack !== 'string' || !/^[A-Z?]{1,7}$/.test(rack))
    return issue(
      'rack',
      'Give the rack one to seven tiles: letters or blanks.'
    );
  if (
    !Number.isInteger(target) ||
    (target as number) < 1 ||
    (target as number) > MAX_TARGET
  )
    return issue('target', `Set a target from 1 to ${MAX_TARGET} points.`);
  return {
    valid: true,
    value: { ruleset, lexicon, board, rack, target: target as number },
  };
}

/** Whether the board and rack together fit inside one physical tile set. */
function withinInventory(puzzle: WordTilesPuzzle): boolean {
  const used = new Map<string, number>();
  const add = (symbol: string) => used.set(symbol, (used.get(symbol) ?? 0) + 1);
  for (const cell of puzzle.board)
    if (cell !== '.') add(cell === cell.toUpperCase() ? cell : BLANK);
  for (const tile of puzzle.rack) add(tile);
  return TILE_KINDS.every((kind) => (used.get(kind.symbol) ?? 0) <= kind.count);
}

/** Every tile reachable from the centre through orthogonal neighbours. */
function connectedThroughCentre(board: string): boolean {
  if (!isOccupied(board, CENTER_CELL)) return false;
  const seen = new Set([CENTER_CELL]);
  const queue = [CENTER_CELL];
  for (let next = queue.pop(); next !== undefined; next = queue.pop())
    for (const n of neighbours(next))
      if (isOccupied(board, n) && !seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
  return [...board].every((cell, at) => cell === '.' || seen.has(at));
}

/** The board's words not in the list (`null` while the list has not loaded). */
function boardUnknownWords(puzzle: WordTilesPuzzle): readonly string[] | null {
  const lexicon = loadedLexicon(puzzle.lexicon);
  if (lexicon === null) return null;
  const words = new Set<string>();
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (!isOccupied(puzzle.board, cell)) continue;
    for (const direction of ['across', 'down'] as const) {
      const run = wordCells(puzzle.board, cell, direction);
      if (run.length >= 2)
        words.add(run.map((c) => puzzle.board[c]!.toUpperCase()).join(''));
    }
  }
  return [...words].filter((word) => !lexicon.has(word));
}

/** A complete, playable definition, or why it is not one. */
export function decodePuzzle(text: string): Decoded<WordTilesPuzzle> {
  const shape = shapeOf(text);
  if (!shape.valid) return shape;
  const puzzle = shape.value;
  if (!withinInventory(puzzle))
    return issue(
      'inventory',
      'The board and rack use more of a letter than the tile set has.'
    );
  if (!boardIsEmpty(puzzle.board) && !connectedThroughCentre(puzzle.board))
    return issue(
      'board-connected',
      'Board tiles must join up through the centre square.'
    );
  const unknown = boardUnknownWords(puzzle);
  if (unknown === null)
    return issue(
      'lexicon-unavailable',
      'The word list is still loading. Try again in a moment.'
    );
  if (unknown.length > 0)
    return issue(
      'board-words',
      `The board spells words not in the list: ${unknown.join(', ')}.`
    );
  return { valid: true, value: puzzle };
}

type PuzzleState = {
  readonly played: string | null;
  readonly score: number | null;
};

const EMPTY_STATE: PuzzleState = { played: null, score: null };

function encodeState(state: PuzzleState): string {
  return JSON.stringify({ v: 1, played: state.played, score: state.score });
}

function decodeState(text: string): PuzzleState | null {
  const raw = parseJson(text);
  if (raw === null || raw['v'] !== 1) return null;
  const { played, score } = raw;
  if (played === null && score === null) return EMPTY_STATE;
  return typeof played === 'string' && Number.isInteger(score)
    ? { played, score: score as number }
    : null;
}

/**
 * Distinct physical tiles standing for a puzzle rack's letters, by rack
 * index (a puzzle has no bag: these only let the game's move search and
 * candidate editing name the rack's tiles).
 */
export function rackTileIds(rack: string): readonly number[] {
  const taken = new Set<number>();
  return [...rack].map((symbol) => {
    const tile = TILES.find((t) => t.symbol === symbol && !taken.has(t.id));
    if (tile === undefined) throw new Error(`no ${symbol} tile for the rack`);
    taken.add(tile.id);
    return tile.id;
  });
}

/** The letters a placement action puts down, from the rack it names, or `null`. */
export function placementOf(
  puzzle: WordTilesPuzzle,
  action: string
): readonly PlacedLetter[] | null {
  if (!action.startsWith('play:')) return null;
  const used = new Set<number>();
  const placed: PlacedLetter[] = [];
  for (const entry of action.slice(5).split('.')) {
    const match = /^([a-o](?:[1-9]|1[0-5]))=([0-6])([A-Z]?)$/.exec(entry);
    const cell = match === null ? null : parseCell(match[1]!);
    const index = Number(match?.[2]);
    const tile = puzzle.rack[index];
    if (
      match === null ||
      cell === null ||
      tile === undefined ||
      used.has(index)
    )
      return null;
    if ((tile === BLANK) !== (match[3] !== '')) return null;
    used.add(index);
    placed.push({
      cell,
      letter: tile === BLANK ? match[3]! : tile,
      blank: tile === BLANK,
    });
  }
  return new Set(placed.map((p) => p.cell)).size === placed.length
    ? placed
    : null;
}

/** The score of `action` against the frozen board, or why it is not a move. */
export function scorePlacement(
  puzzle: WordTilesPuzzle,
  action: string
): Decoded<number> {
  const placed = placementOf(puzzle, action);
  if (placed === null)
    return issue('action', 'Place tiles from the rack on empty squares.');
  const evaluation = evaluatePlacement(puzzle.board, placed);
  if (!evaluation.ok)
    return issue(
      'placement',
      `That placement is not allowed: ${evaluation.refusal}.`
    );
  const lexicon = loadedLexicon(puzzle.lexicon);
  if (lexicon === null)
    return issue(
      'lexicon-unavailable',
      'The word list is still loading. Try again in a moment.'
    );
  const unknown = unknownWords(evaluation.score, lexicon.has);
  return unknown.length > 0
    ? issue('words', `Not in the word list: ${unknown.join(', ')}.`)
    : { valid: true, value: evaluation.score.total };
}

function apply(
  definition: string,
  state: string,
  action: string
): PuzzleChange {
  const puzzle = decodePuzzle(definition);
  if (!puzzle.valid) return { accepted: false, issues: puzzle.issues };
  if (decodeState(state) === null)
    return {
      accepted: false,
      issues: [
        {
          code: 'state',
          message: 'This attempt cannot be read. Retry the puzzle.',
        },
      ],
    };
  const scored = scorePlacement(puzzle.value, action);
  return scored.valid
    ? {
        accepted: true,
        state: encodeState({ played: action, score: scored.value }),
      }
    : { accepted: false, issues: scored.issues };
}

/** Solved exactly when the latest placement, re-scored now, meets the target. */
function complete(definition: string, state: string): boolean {
  const puzzle = decodePuzzle(definition);
  const progress = decodeState(state);
  if (!puzzle.valid || progress?.played == null) return false;
  const scored = scorePlacement(puzzle.value, progress.played);
  return scored.valid && scored.value >= puzzle.value.target;
}

/** Search for a placement meeting the target, within a fixed budget. */
function solve(definition: string): PuzzleSolution {
  const decoded = decodePuzzle(definition);
  if (!decoded.valid) return { status: 'invalid', issues: decoded.issues };
  const puzzle = decoded.value;
  const lexicon = loadedLexicon(puzzle.lexicon);
  if (lexicon === null) return { status: 'inconclusive' };
  const ids = rackTileIds(puzzle.rack);
  const search = generateMoves({
    board: puzzle.board,
    rack: ids,
    trie: lexicon.trie,
    budget: 400_000,
  });
  const best = [...search.moves].sort((a, b) => b.score - a.score)[0];
  if (best === undefined || best.score < puzzle.target)
    return search.complete
      ? { status: 'unsolvable' }
      : { status: 'inconclusive' };
  const action = `play:${best.tiles
    .map((t) => `${cellName(t.cell)}=${ids.indexOf(t.tile)}${t.assigned ?? ''}`)
    .join('.')}`;
  return {
    status: 'solved',
    state: encodeState({ played: action, score: best.score }),
    uniqueness: 'unknown',
  };
}

/**
 * Publication needs a witness: a completed attempt (an author's playtest)
 * whose placement the publishing authority scores again against this exact
 * definition; without one, a bounded search may find one.
 */
function validatePublication(
  definition: string,
  solution?: string
): PuzzleValidation {
  const puzzle = decodePuzzle(definition);
  if (!puzzle.valid) return puzzle;
  if (solution !== undefined)
    return complete(definition, solution)
      ? { valid: true }
      : {
          valid: false,
          issues: [
            {
              code: 'witness',
              message:
                'Play a placement that reaches the target before publishing.',
            },
          ],
        };
  const found = solve(definition);
  if (found.status === 'solved') return { valid: true };
  return {
    valid: false,
    issues: [
      found.status === 'unsolvable'
        ? {
            code: 'unsolvable',
            message:
              'No placement of this rack reaches the target. Lower the target or change the rack.',
          }
        : {
            code: 'inconclusive',
            message:
              'Play a placement that reaches the target to prove the puzzle, then publish.',
          },
    ],
  };
}

export const wordTilesPuzzleContent: PuzzleContent = {
  history: 'snapshots',
  rules: {
    validateDefinition: (definition) => {
      const puzzle = decodePuzzle(definition);
      return puzzle.valid ? { valid: true } : puzzle;
    },
    initial: (definition) => {
      const puzzle = decodePuzzle(definition);
      return puzzle.valid
        ? { accepted: true, state: encodeState(EMPTY_STATE) }
        : { accepted: false, issues: puzzle.issues };
    },
    validateState: (definition, state) => {
      const puzzle = decodePuzzle(definition);
      if (!puzzle.valid) return puzzle;
      return decodeState(state) === null
        ? {
            valid: false,
            issues: [
              {
                code: 'state',
                message: 'This attempt cannot be read. Retry the puzzle.',
              },
            ],
          }
        : { valid: true };
    },
    apply,
    complete,
  },
  solver: { solve },
  validatePublication,
  statistics: (definition, state) => {
    const puzzle = decodePuzzle(definition);
    const progress = decodeState(state);
    return {
      target: puzzle.valid ? puzzle.value.target : 0,
      score: progress?.score ?? 0,
    };
  },
};

/** A state's latest placement and score, for players and editors. */
export function puzzleProgress(state: string): PuzzleState {
  return decodeState(state) ?? EMPTY_STATE;
}
