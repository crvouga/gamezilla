import { DECK, parseCards } from '@libs/hearts-shared-ts/hearts-cards';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';

const SEATS = ['white', 'black', 'red', 'blue'] as const;

/**
 * The draws the room's random port returns for Hearts to deal `hands` (each
 * seat's thirteen cards), then the four that seed its shuffler for later
 * deals: a deal a scenario names, made through the room's own dealing as a
 * documented choice. Hearts deals the first deal with Fisher–Yates, from the
 * last card down, so each draw picks the card that takes the next place.
 */
export function heartsDealDraws(
  hands: Readonly<Record<GameSide, string>>,
  seed: readonly number[] = [0.11, 0.37, 0.59, 0.83]
): readonly number[] {
  const target = SEATS.flatMap((side) => {
    const cards = parseCards(hands[side]);
    if (cards === null || cards.length !== 13)
      throw new Error(`${side} is not dealt thirteen cards`);
    return cards;
  });
  if (new Set(target).size !== 52) throw new Error('a deal holds 52 cards');
  const deck: string[] = [...DECK];
  const draws: number[] = [];
  for (let at = deck.length - 1; at > 0; at -= 1) {
    const pick = deck.indexOf(target[at]!);
    draws.push((pick + 0.5) / (at + 1));
    [deck[at], deck[pick]] = [deck[pick]!, deck[at]!];
  }
  return [...draws, ...seed];
}
