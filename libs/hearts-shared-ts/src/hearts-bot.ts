import type {
  BotDifficulty,
  GameBots,
} from '@pkgs/turn-game-shared-ts/game-rules';
import {
  type Card,
  cardPoints,
  parseCards,
  QUEEN_OF_SPADES,
  rankOf,
  suitOf,
  writeCards,
} from './hearts-cards';
import { decodeHearts, type HeartsPosition } from './hearts-position';
import {
  legalCards,
  seatToPlay,
  tricksOf,
  trickWinner,
} from './hearts-tricks';

/**
 * Hearts bots decide for their own seat with its own cards and the public
 * table alone: they are never given another seat's cards. The easy bot plays
 * any legal card and passes any three; the medium bot passes its most
 * dangerous cards and ducks tricks it would rather not take.
 */

/** One of `options`, drawn with `random`. */
function pick<T>(options: readonly T[], random: () => number): T {
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))]!;
}

/** How much a card is worth getting rid of: the queen and high spades, high hearts, then high cards. */
function danger(card: Card, hand: readonly Card[]): number {
  const rank = rankOf(card);
  const suit = suitOf(card);
  const lowSpades = hand.filter(
    (other) => suitOf(other) === 'S' && rankOf(other) < rankOf(QUEEN_OF_SPADES)
  ).length;
  if (card === QUEEN_OF_SPADES) return lowSpades >= 4 ? 40 : 100;
  if (suit === 'S' && rank > rankOf(QUEEN_OF_SPADES))
    return lowSpades >= 4 ? 30 : 90;
  const shortSuit =
    suit !== 'H' && hand.filter((other) => suitOf(other) === suit).length <= 2;
  return (suit === 'H' ? 20 : 0) + rank * 4 + (shortSuit ? 15 : 0);
}

/** The three cards the medium bot passes: its most dangerous. */
function passThree(hand: readonly Card[], random: () => number): string {
  const ranked = [...hand]
    .map((card) => ({ card, score: danger(card, hand) + random() }))
    .sort((a, b) => b.score - a.score);
  return writeCards(ranked.slice(0, 3).map((entry) => entry.card));
}

/** The card currently winning the trick under way, if any. */
function winningCard(position: HeartsPosition): Card | null {
  const trick = tricksOf(position).at(-1);
  if (trick === undefined || trick.cards.length === 4) return null;
  const winner = trickWinner(trick);
  const offset = (winner - trick.leader + 4) % 4;
  return trick.cards[offset] ?? null;
}

/** The medium bot's card: lead low, duck under the winning card, dump points when void. */
function chooseCard(
  position: HeartsPosition,
  legal: readonly Card[],
  random: () => number
): Card {
  const byRank = [...legal].sort((a, b) => rankOf(a) - rankOf(b));
  const winning = winningCard(position);
  if (winning === null) {
    const safe = byRank.filter((card) => cardPoints(card) === 0);
    const lowest = (safe.length > 0 ? safe : byRank)[0]!;
    return pick(
      byRank.filter((card) => rankOf(card) === rankOf(lowest)),
      random
    );
  }
  const following = legal.every((card) => suitOf(card) === suitOf(winning));
  if (!following) {
    if (legal.includes(QUEEN_OF_SPADES)) return QUEEN_OF_SPADES;
    const hearts = byRank.filter((card) => suitOf(card) === 'H');
    return (hearts.length > 0 ? hearts : byRank).at(-1)!;
  }
  if (legal.includes(QUEEN_OF_SPADES) && rankOf(winning) > rankOf(QUEEN_OF_SPADES))
    return QUEEN_OF_SPADES;
  const under = byRank.filter((card) => rankOf(card) < rankOf(winning));
  if (under.length > 0) return under.at(-1)!;
  const last = position.plays.length % 4 === 3;
  const pointsOnTable = tricksOf(position)
    .at(-1)!
    .cards.some((card) => cardPoints(card) > 0);
  return last && !pointsOnTable ? byRank.at(-1)! : byRank[0]!;
}

/**
 * The bot's pass or card for the seat whose cards held now are `hand`, or
 * `null` when it has nothing to decide. While passing, every seat decides;
 * otherwise only the seat the position names to play.
 */
export function chooseHeartsDecision(
  text: string,
  difficulty: BotDifficulty,
  random: () => number,
  hand: string | null
): string | null {
  const position = decodeHearts(text);
  const held = hand === null ? null : parseCards(hand);
  if (position === null || held === null) return null;
  if (position.phase === 'pass')
    return difficulty === 'easy'
      ? writeCards(shuffled(held, random).slice(0, 3))
      : passThree(held, random);
  const seat = seatToPlay(position);
  const legal = seat === null ? [] : legalCards(position, seat, held);
  if (legal.length === 0) return null;
  return difficulty === 'easy'
    ? pick(legal, random)
    : chooseCard(position, legal, random);
}

function shuffled(cards: readonly Card[], random: () => number): Card[] {
  const deck = [...cards];
  for (let at = deck.length - 1; at > 0; at -= 1) {
    const other = Math.min(at, Math.floor(random() * (at + 1)));
    [deck[at], deck[other]] = [deck[other]!, deck[at]!];
  }
  return deck;
}

export const heartsBots: GameBots = {
  difficulties: ['easy', 'medium'],
  choose: chooseHeartsDecision,
};
