import { CELL_COUNT } from './word-tiles-board';
import { lexiconIdentity } from './word-tiles-lexicon';
import { RULESET, type WordTilesSeatCount } from './word-tiles-ruleset';
import { TILE_COUNT } from './word-tiles-tiles';

/**
 * The public position: everything every viewer may know. The board, each
 * seat's score and rack count, the bag count, the seat to move, the run of
 * zero-point turns and how the game ended. Never a rack's letters, the bag's
 * order or any random state — those are the authority's hidden state.
 *
 * Written `wt<seats>|<ruleset>|<lexicon>|<board>|<scores>|<racks>|<bag>|<turn>|<scoreless>|<end>`;
 * the board is 225 cells row by row, `.` for an empty cell, `A`–`Z` for a
 * tile and `a`–`z` for a blank played as that letter.
 */
export type WordTilesEnding = 'out' | 'scoreless';

export type WordTilesPosition = {
  readonly seats: WordTilesSeatCount;
  readonly ruleset: string;
  readonly lexicon: string;
  readonly board: string;
  readonly scores: readonly number[];
  readonly racks: readonly number[];
  readonly bag: number;
  readonly turn: number;
  readonly scoreless: number;
  readonly ended: WordTilesEnding | null;
};

export const EMPTY_BOARD = '.'.repeat(CELL_COUNT);

export function newPosition(
  seats: WordTilesSeatCount,
  lexicon: string
): WordTilesPosition {
  return {
    seats,
    ruleset: RULESET.id,
    lexicon,
    board: EMPTY_BOARD,
    scores: Array.from({ length: seats }, () => 0),
    racks: Array.from({ length: seats }, () => RULESET.rackSize),
    bag: TILE_COUNT - seats * RULESET.rackSize,
    turn: 0,
    scoreless: 0,
    ended: null,
  };
}

export function encodePosition(p: WordTilesPosition): string {
  return [
    `wt${p.seats}`,
    p.ruleset,
    p.lexicon,
    p.board,
    p.scores.join(','),
    p.racks.join(','),
    String(p.bag),
    String(p.turn),
    String(p.scoreless),
    p.ended ?? '-',
  ].join('|');
}

function integers(text: string, count: number): number[] | null {
  const values = text.split(',');
  if (values.length !== count || !values.every((v) => /^-?\d{1,5}$/.test(v)))
    return null;
  return values.map(Number);
}

function count(text: string, max: number): number | null {
  if (!/^\d{1,3}$/.test(text)) return null;
  const value = Number(text);
  return value <= max ? value : null;
}

/** The position `text` writes, or `null` when it is not a well-formed one. */
export function decodePosition(text: string): WordTilesPosition | null {
  const parts = text.split('|');
  if (parts.length !== 10) return null;
  const [mode, ruleset, lexicon, board, scores, racks, bag, turn, run, end] =
    parts as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
  const seats = { wt2: 2, wt3: 3, wt4: 4 }[mode] as
    | WordTilesSeatCount
    | undefined;
  if (seats === undefined || ruleset !== RULESET.id) return null;
  if (lexiconIdentity(lexicon) === null) return null;
  if (!/^[.A-Za-z]+$/.test(board) || board.length !== CELL_COUNT) return null;
  const parsedScores = integers(scores, seats);
  const parsedRacks = integers(racks, seats);
  const parsedBag = count(bag, TILE_COUNT);
  const parsedTurn = count(turn, seats - 1);
  const parsedRun = count(run, RULESET.scorelessTurnLimit);
  if (
    parsedScores === null ||
    parsedRacks === null ||
    parsedRacks.some((r) => r < 0 || r > RULESET.rackSize) ||
    parsedBag === null ||
    parsedTurn === null ||
    parsedRun === null ||
    (end !== '-' && end !== 'out' && end !== 'scoreless')
  )
    return null;
  return {
    seats,
    ruleset,
    lexicon,
    board,
    scores: parsedScores,
    racks: parsedRacks,
    bag: parsedBag,
    turn: parsedTurn,
    scoreless: parsedRun,
    ended: end === '-' ? null : end,
  };
}

/** The seats sharing the highest score of an ended game. */
export function leadingSeats(p: WordTilesPosition): readonly number[] {
  const best = Math.max(...p.scores);
  return p.scores.flatMap((score, seat) => (score === best ? [seat] : []));
}

/** The tiles on the board: letters of every occupied cell. */
export function boardTileCount(board: string): number {
  let tiles = 0;
  for (const cell of board) if (cell !== '.') tiles++;
  return tiles;
}
