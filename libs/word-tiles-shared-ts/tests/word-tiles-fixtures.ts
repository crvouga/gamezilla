import { parseCell } from '../src/word-tiles-board';
import type { HiddenState } from '../src/word-tiles-hidden';
import {
  DEFAULT_LEXICON_KEY,
  type Lexicon,
  loadLexicon,
} from '../src/word-tiles-lexicon';
import {
  EMPTY_BOARD,
  newPosition,
  type WordTilesPosition,
} from '../src/word-tiles-position';
import type { WordTilesSeatCount } from '../src/word-tiles-ruleset';
import { BLANK, TILES } from '../src/word-tiles-tiles';

/** Test-only builders: hidden states and boards written from letters, by hand. */

export function lexicon(): Promise<Lexicon> {
  return loadLexicon(DEFAULT_LEXICON_KEY);
}

/** Distinct tile ids spelling `letters` (`?` a blank), none of `taken`. */
export function idsOf(letters: string, taken: Set<number>): number[] {
  return [...letters].map((symbol) => {
    const tile = TILES.find((t) => t.symbol === symbol && !taken.has(t.id));
    if (tile === undefined) throw new Error(`no ${symbol} tile left`);
    taken.add(tile.id);
    return tile.id;
  });
}

/**
 * A hidden state whose racks hold `racks` (letters per seat), whose bag
 * starts with `bagFront` and then every other tile, and whose board holds
 * `board` tiles, keeping exactly `bagSize` tiles in the bag.
 */
export function hiddenWith(spec: {
  readonly racks: readonly string[];
  readonly bagFront?: string;
  readonly board?: string;
  readonly bagSize?: number;
}): HiddenState {
  const taken = new Set<number>();
  const racks = spec.racks.map((letters) => idsOf(letters, taken));
  const board = idsOf(spec.board ?? '', taken);
  const front = idsOf(spec.bagFront ?? '', taken);
  const rest = TILES.map((t) => t.id).filter((id) => !taken.has(id));
  const bag = [...front, ...rest];
  const keep = spec.bagSize ?? bag.length;
  return {
    racks,
    bag: bag.slice(0, keep),
    // Tiles left out of a smaller bag are on the board already.
    board: [...board, ...bag.slice(keep)],
    rng: [7, 7, 7, 7],
  };
}

/** A board with `words` written on it: `[first cell, direction, letters]`. */
export function boardWith(
  words: readonly (readonly [string, 'across' | 'down', string])[]
): string {
  const cells = EMPTY_BOARD.split('');
  for (const [start, direction, letters] of words) {
    const first = parseCell(start)!;
    [...letters].forEach((letter, n) => {
      cells[first + n * (direction === 'across' ? 1 : 15)] = letter;
    });
  }
  return cells.join('');
}

/** The position matching `hidden`: counts from it, board and scores as given. */
export function positionFor(
  hidden: HiddenState,
  extra: Partial<WordTilesPosition> = {}
): WordTilesPosition {
  const seats = hidden.racks.length as WordTilesSeatCount;
  return {
    ...newPosition(seats, DEFAULT_LEXICON_KEY),
    racks: hidden.racks.map((rack) => rack.length),
    bag: hidden.bag.length,
    ...extra,
  };
}

/** `tile` written as a proposal entry on `cell` (a blank as `letter`). */
export function at(cell: string, tile: number, letter = ''): string {
  return `${cell}=${tile}${TILES[tile]!.symbol === BLANK ? letter : ''}`;
}
