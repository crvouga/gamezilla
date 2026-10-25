import {
  type Card,
  cardPoints,
  DEAL_POINTS,
  QUEEN_OF_SPADES,
  rankOf,
  suitOf,
} from './hearts-cards';
import {
  type HeartsPosition,
  MATCH_TARGET,
  type Seat,
  seatAfter,
} from './hearts-position';

/** One trick: who led it and the cards played to it, in order. */
export type Trick = {
  readonly leader: Seat;
  readonly cards: readonly Card[];
};

/** The highest card of the led suit wins; its seat leads next. */
export function trickWinner(trick: Trick): Seat {
  const led = suitOf(trick.cards[0]!);
  let best = 0;
  for (const [index, card] of trick.cards.entries())
    if (suitOf(card) === led && rankOf(card) > rankOf(trick.cards[best]!))
      best = index;
  return seatAfter(trick.leader, best);
}

/** The deal's tricks so far, the last one possibly incomplete. */
export function tricksOf(position: HeartsPosition): readonly Trick[] {
  if (position.lead === null) return [];
  const tricks: Trick[] = [];
  let leader: Seat = position.lead;
  for (let at = 0; at < position.plays.length; at += 4) {
    const trick = { leader, cards: position.plays.slice(at, at + 4) };
    tricks.push(trick);
    if (trick.cards.length === 4) leader = trickWinner(trick);
  }
  return tricks;
}

/** The seat that played each card of the deal, in play order. */
export function seatsOfPlays(position: HeartsPosition): readonly Seat[] {
  return tricksOf(position).flatMap((trick) =>
    trick.cards.map((_, index) => seatAfter(trick.leader, index))
  );
}

/** The cards `seat` has played in this deal. */
export function playedBy(position: HeartsPosition, seat: Seat): Card[] {
  const seats = seatsOfPlays(position);
  return position.plays.filter((_, index) => seats[index] === seat);
}

/** The seat to play, or `null` while passing or once the match is over. */
export function seatToPlay(position: HeartsPosition): Seat | null {
  if (position.phase !== 'play' || position.lead === null) return null;
  const tricks = tricksOf(position);
  const last = tricks.at(-1);
  if (last === undefined) return position.lead;
  return last.cards.length === 4
    ? trickWinner(last)
    : seatAfter(last.leader, last.cards.length);
}

/** Whether a heart has been played in this deal (the queen of spades alone does not break hearts). */
export function heartsBroken(position: HeartsPosition): boolean {
  return position.plays.some((card) => suitOf(card) === 'H');
}

/** The penalty points each seat has taken in this deal so far. */
export function takenPoints(position: HeartsPosition): number[] {
  const taken = [0, 0, 0, 0];
  for (const trick of tricksOf(position))
    if (trick.cards.length === 4)
      taken[trickWinner(trick)]! += trick.cards.reduce(
        (sum, card) => sum + cardPoints(card),
        0
      );
  return taken;
}

/**
 * What a complete deal adds to each score: its penalty points, unless one
 * seat took all twenty-six (shooting the moon), which adds nothing to that
 * seat and twenty-six to each other.
 */
export function dealScores(taken: readonly number[]): number[] {
  const shooter = taken.indexOf(DEAL_POINTS);
  return shooter < 0
    ? [...taken]
    : taken.map((_, seat) => (seat === shooter ? 0 : DEAL_POINTS));
}

/** Whether the match ends with these cumulative scores. */
export function matchOver(scores: readonly number[]): boolean {
  return scores.some((score) => score >= MATCH_TARGET);
}

/** The seats sharing the lowest cumulative score: the joint winners. */
export function lowestSeats(scores: readonly number[]): readonly Seat[] {
  const lowest = Math.min(...scores);
  return ([0, 1, 2, 3] as const).filter((seat) => scores[seat] === lowest);
}

/**
 * The cards `seat` may play from `hand`, its cards not yet played: the one
 * legality the authority, the table and the bots share. The two of clubs
 * leads the first trick; a player follows the led suit when they can; on the
 * first trick hearts and the queen of spades wait unless nothing else is
 * left; hearts are led only once broken, unless only hearts remain.
 */
export function legalCards(
  position: HeartsPosition,
  seat: Seat,
  hand: readonly Card[]
): Card[] {
  if (seatToPlay(position) !== seat) return [];
  const inTrick = position.plays.length % 4;
  const firstTrick = position.plays.length < 4;
  if (inTrick === 0) {
    if (firstTrick) return hand.filter((card) => card === '2C');
    const leads = heartsBroken(position)
      ? [...hand]
      : hand.filter((card) => suitOf(card) !== 'H');
    return leads.length > 0 ? leads : [...hand];
  }
  const led = suitOf(position.plays[position.plays.length - inTrick]!);
  const following = hand.filter((card) => suitOf(card) === led);
  if (following.length > 0) return following;
  if (!firstTrick) return [...hand];
  const safe = hand.filter(
    (card) => suitOf(card) !== 'H' && card !== QUEEN_OF_SPADES
  );
  return safe.length > 0 ? safe : [...hand];
}

/** Why a card is refused, as a person is told it. */
export type CardRefusal =
  | 'not your turn'
  | 'not your card'
  | 'lead the two of clubs'
  | 'follow suit'
  | 'no points on the first trick'
  | 'hearts not broken';

/**
 * Why `seat` may not play `card` from `hand`, or `null` when it may: the
 * same rules as {@link legalCards}, explained.
 */
export function cardRefusal(
  position: HeartsPosition,
  seat: Seat,
  hand: readonly Card[],
  card: Card
): CardRefusal | null {
  if (seatToPlay(position) !== seat) return 'not your turn';
  if (!hand.includes(card)) return 'not your card';
  if (legalCards(position, seat, hand).includes(card)) return null;
  const inTrick = position.plays.length % 4;
  if (position.plays.length === 0) return 'lead the two of clubs';
  if (inTrick === 0) return 'hearts not broken';
  const led = suitOf(position.plays[position.plays.length - inTrick]!);
  return hand.some((held) => suitOf(held) === led)
    ? 'follow suit'
    : 'no points on the first trick';
}
