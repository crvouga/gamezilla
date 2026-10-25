import { encodeHearts } from '@libs/hearts-shared-ts/hearts-position';

/**
 * Known deals, written by hand from the rules' own words rather than drawn
 * by the implementation.
 */
const RANKS = '23456789TJQKA';
const suit = (letter: string): string =>
  [...RANKS].map((rank) => `${rank}${letter}`).join('');

/** Each seat holds one whole suit: South clubs, West diamonds, North spades, East hearts. */
export const SUITS_HANDS = {
  white: suit('C'),
  black: suit('D'),
  red: suit('S'),
  blue: suit('H'),
} as const;
/** The hidden state of the suits deal, its shuffler at a fixed state. */
export const SUITS_DEAL = `1.2.3.4|${SUITS_HANDS.white}|${SUITS_HANDS.black}|${SUITS_HANDS.red}|${SUITS_HANDS.blue}`;

/** The cards of `suitLetter` from `from` to `to` (ranks as written). */
export function cardsOf(suitLetter: string, ranks: string): string[] {
  return [...ranks].map((rank) => `${rank}${suitLetter}`);
}

/** The start of a deal without passing (the fourth), South holding the two of clubs. */
export function holdDealStart(scores: readonly number[]): string {
  return encodeHearts({
    deal: 4,
    phase: 'play',
    scores,
    lead: 0,
    plays: [],
    last: [0, 0, 0, 0],
  });
}

/**
 * A deal where every trick is won by South's club: South leads its clubs in
 * order while the others, void, give up their own suits in order.
 */
export function suitsDealPlays(): string[] {
  const plays: string[] = [];
  for (let trick = 0; trick < 13; trick += 1)
    for (const letter of ['C', 'D', 'S', 'H'])
      plays.push(`${RANKS[trick]!}${letter}`);
  return plays;
}
