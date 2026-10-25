/**
 * The standard 52-card deck as Hearts writes it: a card is its rank then its
 * suit (`QS` is the queen of spades, `TH` the ten of hearts). A hand is its
 * cards in deck order, written one after another.
 */

export const SUITS = ['C', 'D', 'S', 'H'] as const;
export type Suit = (typeof SUITS)[number];
export const RANKS = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'T',
  'J',
  'Q',
  'K',
  'A',
] as const;
export type Rank = (typeof RANKS)[number];
export type Card = `${Rank}${Suit}`;

export const DECK: readonly Card[] = SUITS.flatMap((suit) =>
  RANKS.map((rank): Card => `${rank}${suit}`)
);
export const TWO_OF_CLUBS: Card = '2C';
export const QUEEN_OF_SPADES: Card = 'QS';
/** Every heart and the queen of spades: the deal's twenty-six penalty points. */
export const DEAL_POINTS = 26;

const CARDS: ReadonlySet<string> = new Set(DECK);

export function isCard(value: string): value is Card {
  return CARDS.has(value);
}

export function suitOf(card: Card): Suit {
  return card[1] as Suit;
}

/** The card's rank, from 0 (two) to 12 (ace). */
export function rankOf(card: Card): number {
  return RANKS.indexOf(card[0] as Rank);
}

/** Penalty points: one for each heart, thirteen for the queen of spades. */
export function cardPoints(card: Card): number {
  if (card === QUEEN_OF_SPADES) return 13;
  return suitOf(card) === 'H' ? 1 : 0;
}

/** Cards in deck order: clubs, diamonds, spades, hearts, each two to ace. */
export function sortCards(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => DECK.indexOf(a) - DECK.indexOf(b));
}

/** Distinct cards written one after another, or `null` for anything else. */
export function parseCards(text: string): Card[] | null {
  if (text.length % 2 !== 0) return null;
  const cards: Card[] = [];
  for (let at = 0; at < text.length; at += 2) {
    const card = text.slice(at, at + 2);
    if (!isCard(card) || cards.includes(card)) return null;
    cards.push(card);
  }
  return cards;
}

/** A hand or a set of passed cards as Hearts stores it: deck order. */
export function writeCards(cards: readonly Card[]): string {
  return sortCards(cards).join('');
}

const SUIT_SYMBOLS: Readonly<Record<Suit, string>> = {
  C: '♣',
  D: '♦',
  S: '♠',
  H: '♥',
};

/** The card as a move list writes it: `Q♠`, `10♥`. */
export function cardLabel(card: Card): string {
  const rank = card[0] === 'T' ? '10' : card[0]!;
  return `${rank}${SUIT_SYMBOLS[suitOf(card)]}`;
}
