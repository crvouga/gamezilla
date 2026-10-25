import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';

/**
 * The one baseline ruleset, versioned: every number a match or a puzzle
 * plays by. These are product decisions for this game, not a claim of
 * tournament compliance. A match and a puzzle pin the ruleset id, so a
 * later ruleset never changes what an existing one accepted.
 */
export const RULESET = {
  id: 'r1',
  rackSize: 7,
  /** Added once when a placement uses seven tiles. */
  sevenTileBonus: 50,
  /** Consecutive zero-point turns that end the game. */
  scorelessTurnLimit: 6,
  /** Tiles the bag must hold, at the start of an exchange, to allow it. */
  exchangeMinimumBag: 7,
} as const;

export const WORD_TILES_SEATS = ['white', 'black', 'red', 'blue'] as const;
export type WordTilesSeatCount = 2 | 3 | 4;

/** The ids of the three table sizes, each its own registered mode. */
export const WORD_TILES_IDS: Readonly<Record<WordTilesSeatCount, string>> = {
  2: 'word-tiles',
  3: 'word-tiles-3',
  4: 'word-tiles-4',
};

export const WORD_TILES_FAMILY = 'word-tiles';

export function seatSides(seats: WordTilesSeatCount): readonly GameSide[] {
  return WORD_TILES_SEATS.slice(0, seats);
}

export function seatOf(side: GameSide, seats: number): number | null {
  const index = WORD_TILES_SEATS.indexOf(
    side as (typeof WORD_TILES_SEATS)[number]
  );
  return index === -1 || index >= seats ? null : index;
}

export function sideOf(seat: number): GameSide {
  const side = WORD_TILES_SEATS[seat];
  if (side === undefined) throw new Error(`no seat ${seat}`);
  return side;
}
