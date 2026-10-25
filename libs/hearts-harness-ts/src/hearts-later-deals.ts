/**
 * Hearts lines that reach a later deal. Only the first deal is written by
 * hand; every later deal comes from the shuffler the room seeds as the game
 * starts, so a scenario that names what a later deal holds names a seed:
 * each below was found once by trying seeds in turn, frozen here, and is
 * checked in this package's tests. The line to it is the documented policy
 * (`heartsLineUntil`) from the passing deal.
 */

import { parseCards } from '@libs/hearts-shared-ts/hearts-cards';
import { KNOWN_DRAWS, KNOWN_HIDDEN, SOUTH_VICTORY } from './hearts-known-match';
import { type HeartsLine, heartsLineUntil } from './hearts-lines';
import { PASSING_DEAL } from './hearts-tables';

/**
 * Seeds whose deal of that number, once reached, awaits passes with South
 * holding the ace, king and queen of spades and East the two, three and
 * four of diamonds.
 */
const AWAITING_SEEDS: Readonly<Record<number, readonly number[]>> = {
  2: [0.736718, 0.017232, 0.406755, 0.023157],
  3: [0.971851, 0.292196, 0.336897, 0.990067],
  5: [0.138066, 0.279375, 0.960036, 0.395905],
};

/** A seed whose fourth deal gives South the ace, king and queen of spades. */
const FOURTH_DEAL_SEED = [0.136016, 0.065186, 0.810539, 0.65466];

/**
 * A seed whose third deal's last card is East's, every cumulative score
 * below 50 before it.
 */
const THIRD_DEAL_LAST_CARD_SEED = [0.712689, 0.426458, 0.986679, 0.131968];

/** The `deal`th deal awaiting passes (South: ace, king, queen of spades; East: two, three, four of diamonds). */
export function awaitingPassesIn(deal: number): HeartsLine {
  if (deal === 1) return { hands: PASSING_DEAL, history: [] };
  const seed = AWAITING_SEEDS[deal];
  if (seed === undefined) throw new Error(`no known seed for deal ${deal}`);
  return heartsLineUntil(
    { hands: PASSING_DEAL, seed, history: [] },
    (at) => at.position.deal === deal
  );
}

/** The fourth deal, before its first card: South holds the ace, king and queen of spades. */
export function fourthDealStarted(): HeartsLine {
  return heartsLineUntil(
    { hands: PASSING_DEAL, seed: FOURTH_DEAL_SEED, history: [] },
    (at) => at.position.deal === 4
  );
}

/** The third deal with only its last card, East's, still to be played. */
export function thirdDealLastCard(): HeartsLine {
  return heartsLineUntil(
    { hands: PASSING_DEAL, seed: THIRD_DEAL_LAST_CARD_SEED, history: [] },
    (at) => at.position.deal === 3 && at.position.plays.length === 51
  );
}

/** The second deal once its first trick has been played. */
export function secondDealFirstTrick(): HeartsLine {
  return heartsLineUntil(
    { hands: PASSING_DEAL, history: [] },
    (at) => at.position.deal === 2 && at.position.plays.length === 4
  );
}

/** The game's known deal, as the hands and seed its known draws deal. */
function knownDeal(): Pick<HeartsLine, 'hands' | 'seed'> {
  const [, white = '', black = '', red = '', blue = ''] =
    KNOWN_HIDDEN.split('|');
  for (const hand of [white, black, red, blue])
    if (parseCards(hand)?.length !== 13)
      throw new Error('the known deal gives every seat thirteen cards');
  return { hands: { white, black, red, blue }, seed: KNOWN_DRAWS.slice(51) };
}

/** The known game South wins alone, every card of it played. */
export function southVictory(): HeartsLine {
  return { ...knownDeal(), history: SOUTH_VICTORY };
}
