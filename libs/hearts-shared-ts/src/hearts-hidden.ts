import { type Card, DECK, parseCards, writeCards } from './hearts-cards';
import { HEARTS_SIDES, type Seat } from './hearts-position';

/**
 * What only the authority holds: every seat's cards and the state of the
 * shuffler that deals the next deal. A seed that can rebuild a hand is as
 * secret as the hand, so it never leaves the authority either; it is 128
 * bits drawn from the room's unpredictable source, so a player who knows
 * their own cards cannot search every seed for the others'. xoshiro128** is
 * not a cryptographic generator, though: the cards a match reveals are
 * evidence about its state, so its later deals resist casual inference, not
 * a determined solver (see docs/HEARTS_IMPLEMENTATION.md). Written
 * `<shuffler>|<South>|<West>|<North>|<East>`, the shuffler as four 32-bit
 * words joined by `.`, each seat's cards in deck order.
 */
export type Shuffler = readonly [number, number, number, number];
export type HeartsHidden = {
  /** The shuffler's state (xoshiro128**), four 32-bit unsigned words, not all zero. */
  readonly shuffler: Shuffler;
  /** The cards each seat holds now, in seat order. */
  readonly hands: readonly (readonly Card[])[];
};

const WORD = /^(0|[1-9][0-9]{0,9})$/;

export function writeHidden(hidden: HeartsHidden): string {
  return [hidden.shuffler.join('.'), ...hidden.hands.map(writeCards)].join('|');
}

function readShuffler(text: string): Shuffler | null {
  const words = text.split('.');
  if (words.length !== 4 || !words.every((word) => WORD.test(word)))
    return null;
  const state = words.map(Number);
  if (state.some((word) => word > 0xffffffff) || state.every((w) => w === 0))
    return null;
  return state as unknown as Shuffler;
}

export function readHidden(text: string): HeartsHidden | null {
  const parts = text.split('|');
  if (parts.length !== 5) return null;
  const shuffler = readShuffler(parts[0]!);
  if (shuffler === null) return null;
  const hands = parts.slice(1).map(parseCards);
  if (hands.some((hand) => hand === null)) return null;
  const all = hands.flat();
  if (new Set(all).size !== all.length) return null;
  return { shuffler, hands: hands as Card[][] };
}

const rotl = (x: number, k: number): number =>
  ((x << k) | (x >>> (32 - k))) >>> 0;

/** One step of the shuffler (xoshiro128**): the next state and a number in [0, 1). */
function next(state: Shuffler): {
  readonly state: Shuffler;
  readonly value: number;
} {
  const [a, b, c, d] = state;
  const result = Math.imul(rotl(Math.imul(b, 5) >>> 0, 7), 9) >>> 0;
  const t = (b << 9) >>> 0;
  let c2 = (c ^ a) >>> 0;
  let d2 = (d ^ b) >>> 0;
  const b2 = (b ^ c2) >>> 0;
  const a2 = (a ^ d2) >>> 0;
  c2 = (c2 ^ t) >>> 0;
  d2 = rotl(d2, 11);
  return { state: [a2, b2, c2, d2], value: result / 4294967296 };
}

/** A shuffler seeded with four 32-bit words (all zero is replaced, as xoshiro needs). */
export function shufflerFrom(words: readonly number[]): Shuffler {
  const state = [0, 1, 2, 3].map((i) => (words[i] ?? 0) >>> 0);
  return (state.every((word) => word === 0)
    ? [1, 0, 0, 0]
    : state) as unknown as Shuffler;
}

/**
 * The deck shuffled with `random` (Fisher–Yates, from the last card down):
 * fifty-one draws, each choosing which remaining card takes the next place.
 */
export function shuffleDeck(random: () => number): Card[] {
  const deck = [...DECK];
  for (let at = deck.length - 1; at > 0; at -= 1) {
    const pick = Math.min(at, Math.floor(random() * (at + 1)));
    [deck[at], deck[pick]] = [deck[pick]!, deck[at]!];
  }
  return deck;
}

/** Thirteen cards to each seat, in seat order, from a shuffled deck. */
export function handsOf(deck: readonly Card[]): Card[][] {
  return HEARTS_SIDES.map((_, seat) => [
    ...deck.slice(seat * 13, seat * 13 + 13),
  ]);
}

/** A deal from the hidden shuffler, and the shuffler after it. */
export function dealFrom(shuffler: Shuffler): HeartsHidden {
  let state = shuffler;
  const deck = shuffleDeck(() => {
    const drawn = next(state);
    state = drawn.state;
    return drawn.value;
  });
  return { shuffler: state, hands: handsOf(deck) };
}

/** The seat holding the two of clubs. */
export function twoOfClubsSeat(hidden: HeartsHidden): Seat {
  const seat = hidden.hands.findIndex((hand) => hand.includes('2C'));
  if (seat < 0) throw new Error('every deal holds the two of clubs');
  return seat as Seat;
}
