import type { Card, Suit } from '@libs/hearts-shared-ts/hearts-cards';
import { suitOf } from '@libs/hearts-shared-ts/hearts-cards';
import type { PassDirection } from '@libs/hearts-shared-ts/hearts-position';
import { t } from '@lingui/core/macro';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CardSuit } from '@pkgs/ui-root-client-ts/card-table';

/** The seats, clockwise from the first: South, West, North, East. */
export function heartsSeatName(side: GameSide): string {
  const names: Readonly<Record<GameSide, string>> = {
    white: t`South`,
    black: t`West`,
    red: t`North`,
    blue: t`East`,
  };
  return names[side];
}

export const SUIT_NAMES: Readonly<Record<Suit, CardSuit>> = {
  C: 'clubs',
  D: 'diamonds',
  S: 'spades',
  H: 'hearts',
};

/** The rank as a card shows it: `10` for the ten. */
export function rankText(card: Card): string {
  return card[0] === 'T' ? '10' : card[0]!;
}

function rankName(card: Card): string {
  const names: Readonly<Record<string, string>> = {
    '2': t`Two`,
    '3': t`Three`,
    '4': t`Four`,
    '5': t`Five`,
    '6': t`Six`,
    '7': t`Seven`,
    '8': t`Eight`,
    '9': t`Nine`,
    T: t`Ten`,
    J: t`Jack`,
    Q: t`Queen`,
    K: t`King`,
    A: t`Ace`,
  };
  return names[card[0]!] ?? card[0]!;
}

/** A card's full name, `Queen of spades`. */
export function cardName(card: Card): string {
  const rank = rankName(card);
  const suits: Readonly<Record<Suit, string>> = {
    C: t`${rank} of clubs`,
    D: t`${rank} of diamonds`,
    S: t`${rank} of spades`,
    H: t`${rank} of hearts`,
  };
  return suits[suitOf(card)];
}

export function passInstruction(direction: PassDirection): string {
  const instructions: Readonly<Record<PassDirection, string>> = {
    left: t`Choose three cards to pass to the left.`,
    right: t`Choose three cards to pass to the right.`,
    across: t`Choose three cards to pass across.`,
    hold: t`No passing this deal.`,
  };
  return instructions[direction];
}
