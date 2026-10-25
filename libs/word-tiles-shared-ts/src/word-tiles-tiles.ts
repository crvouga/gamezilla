/**
 * The baseline English tile set: 100 physical tiles, two of them blanks.
 * Each count and point value is data; tile identities are the positions of
 * the tiles in this table's expansion, so two `E` tiles are two distinct
 * inventory items and a command can never spend the same tile twice.
 */

/** The symbol a blank tile carries before it is assigned a letter. */
export const BLANK = '?';

export type TileKind = {
  /** `A`–`Z`, or {@link BLANK}. */
  readonly symbol: string;
  readonly points: number;
  readonly count: number;
};

export const TILE_KINDS: readonly TileKind[] = [
  { symbol: 'A', points: 1, count: 9 },
  { symbol: 'B', points: 3, count: 2 },
  { symbol: 'C', points: 3, count: 2 },
  { symbol: 'D', points: 2, count: 4 },
  { symbol: 'E', points: 1, count: 12 },
  { symbol: 'F', points: 4, count: 2 },
  { symbol: 'G', points: 2, count: 3 },
  { symbol: 'H', points: 4, count: 2 },
  { symbol: 'I', points: 1, count: 9 },
  { symbol: 'J', points: 8, count: 1 },
  { symbol: 'K', points: 5, count: 1 },
  { symbol: 'L', points: 1, count: 4 },
  { symbol: 'M', points: 3, count: 2 },
  { symbol: 'N', points: 1, count: 6 },
  { symbol: 'O', points: 1, count: 8 },
  { symbol: 'P', points: 3, count: 2 },
  { symbol: 'Q', points: 10, count: 1 },
  { symbol: 'R', points: 1, count: 6 },
  { symbol: 'S', points: 1, count: 4 },
  { symbol: 'T', points: 1, count: 6 },
  { symbol: 'U', points: 1, count: 4 },
  { symbol: 'V', points: 4, count: 2 },
  { symbol: 'W', points: 4, count: 2 },
  { symbol: 'X', points: 8, count: 1 },
  { symbol: 'Y', points: 4, count: 2 },
  { symbol: 'Z', points: 10, count: 1 },
  { symbol: BLANK, points: 0, count: 2 },
];

/** One physical tile: its stable identity, symbol and value. */
export type Tile = {
  readonly id: number;
  readonly symbol: string;
  readonly points: number;
};

function expand(kinds: readonly TileKind[]): readonly Tile[] {
  const tiles: Tile[] = [];
  for (const kind of kinds)
    for (let n = 0; n < kind.count; n++)
      tiles.push({
        id: tiles.length,
        symbol: kind.symbol,
        points: kind.points,
      });
  return tiles;
}

/** Every physical tile, indexed by its identity. */
export const TILES: readonly Tile[] = expand(TILE_KINDS);
export const TILE_COUNT = TILES.length;

/** The physical tile `id`, or `null` when no tile has that identity. */
export function tileOf(id: number): Tile | null {
  return Number.isInteger(id) ? (TILES[id] ?? null) : null;
}

/** The symbol of tile `id` (`A`–`Z` or {@link BLANK}); `''` for no tile. */
export function tileSymbol(id: number): string {
  return tileOf(id)?.symbol ?? '';
}

export function isBlankTile(id: number): boolean {
  return tileOf(id)?.symbol === BLANK;
}

/** A letter's face value, `0` for anything that is not `A`–`Z`. */
export function letterPoints(letter: string): number {
  return TILE_KINDS.find((kind) => kind.symbol === letter)?.points ?? 0;
}

/** Whether `letter` is one plain uppercase ASCII letter. */
export function isLetter(letter: string): boolean {
  return /^[A-Z]$/.test(letter);
}

/** The value of the tiles `ids` (a rack left at the end). */
export function rackValue(ids: readonly number[]): number {
  let total = 0;
  for (const id of ids) total += tileOf(id)?.points ?? 0;
  return total;
}
