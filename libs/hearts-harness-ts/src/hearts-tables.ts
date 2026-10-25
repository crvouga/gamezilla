/**
 * The Hearts tables the `specs/hearts/` scenarios are played at: for each, a
 * first deal written by hand (the hands each player holds once the first
 * deal's passes to the left have changed hands, and the three cards each
 * passes), and a line of play whose stages the scenarios name. Every line
 * is a legal game, checked by the authority's own rules when it is played
 * (`heartsReached`) and in this package's tests.
 *
 * Seats: South is `white`, West `black`, North `red` and East `blue`; a
 * hand is its cards one after another (`QS` the queen of spades).
 */

import { parseCards } from '@libs/hearts-shared-ts/hearts-cards';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  committedProposal,
  type HeartsHands,
  type HeartsLine,
} from './hearts-lines';

const SEATS: readonly GameSide[] = ['white', 'black', 'red', 'blue'];

function cards(text: string): readonly string[] {
  const parsed = parseCards(text.replaceAll(' ', ''));
  if (parsed === null) throw new Error(`${text} is not a set of cards`);
  return parsed;
}

/** Hands as the room deals them: each seat's cards one after another. */
function written(hands: HeartsHands): HeartsHands {
  return Object.fromEntries(
    SEATS.map((side) => [side, cards(hands[side]).join('')])
  ) as Record<GameSide, string>;
}

/** The seat a first-deal pass goes to: the next clockwise. */
function leftOf(side: GameSide): GameSide {
  return SEATS[(SEATS.indexOf(side) + 1) % 4]!;
}

/** The seat whose first-deal pass `side` receives. */
function rightOf(side: GameSide): GameSide {
  return SEATS[(SEATS.indexOf(side) + 3) % 4]!;
}

/**
 * The first deal that becomes `after` once every player has passed to the
 * left, and that pass as one proposal: each player passes the three last
 * cards (as written) of the hand they pass to, unless `passes` names theirs.
 */
export function passedLeft(
  after: HeartsHands,
  passes: Partial<HeartsHands> = {}
): { readonly hands: HeartsHands; readonly pass: string } {
  const given = Object.fromEntries(
    SEATS.map((side) => [
      side,
      passes[side] === undefined
        ? cards(after[leftOf(side)]).slice(-3)
        : cards(passes[side]),
    ])
  ) as Record<GameSide, readonly string[]>;
  const hands = Object.fromEntries(
    SEATS.map((side) => {
      const kept = cards(after[side]).filter(
        (card) => !given[rightOf(side)].includes(card)
      );
      return [side, [...kept, ...given[side]].join('')];
    })
  ) as Record<GameSide, string>;
  return {
    hands,
    pass: committedProposal(SEATS.map((side) => given[side].join(''))),
  };
}

/** A table: its first deal, a line of play, and the stages scenarios name in it. */
export type HeartsTable = {
  readonly line: HeartsLine;
  /** How many proposals of the line each named stage has played. */
  readonly stages: Readonly<Record<string, number>>;
};

function table(
  after: HeartsHands,
  play: string,
  stages: Readonly<Record<string, number>>
): HeartsTable {
  const { hands, pass } = passedLeft(after);
  const history = [pass, ...play.split(' ').filter((card) => card !== '')];
  return { line: { hands, history }, stages };
}

/** The line of `table` as far as its `stage`. */
export function lineAt(at: HeartsTable, stage: string): HeartsLine {
  const played = at.stages[stage];
  if (played === undefined) throw new Error(`no stage ${stage} at this table`);
  return { ...at.line, history: at.line.history.slice(0, played) };
}

/**
 * Before anyone passes: South holds the ace, king and queen of spades and
 * the two of clubs, West the ace, king and queen of hearts but not the
 * queen of spades, and East the two, three and four of diamonds.
 */
export const PASSING_DEAL: HeartsHands = written({
  white: 'AS KS QS 2C 5C 6C 7C 8C 5D 6D 7D 2H 3H',
  black: 'AH KH QH JH TH 9C TC JC 8D 9D TD 2S 3S',
  red: 'KC AC 7S 8S 9S TS JS 4H 5H 6H 7H 8H 9H',
  blue: '2D 3D 4D JD QD KD AD 3C 4C QC 4S 5S 6S',
});

/**
 * South leads the two of clubs; West's only club is the nine, and West
 * holds the ace of diamonds but not the ace of spades; North holds the
 * king of clubs.
 */
export const TRICK_TABLE = table(
  {
    white: '2C 3C 4C 5C 2D 3D 4D 2S 3S 4S 2H 3H 4H',
    black: '9C AD KD QD JD KS JS TS AH KH QH JH TH',
    red: 'KC AC TC 8C 7C 6C 5D 6D 7D 5S 6S 7S 5H',
    blue: 'JC QC 8D 9D TD 8S 9S QS AS 6H 7H 8H 9H',
  },
  '2C',
  { passed: 1, 'south led': 2 }
);

/**
 * The first two tricks at the trick table with a stand-in playing West
 * (`*`, its own card): South leads the two of clubs, West can only follow
 * with the nine, North plays the six and East takes the trick with the
 * jack, then leads the queen, which takes the second trick too.
 */
export const STAND_IN_FIRST_TWO_TRICKS: readonly string[] = [
  '2C',
  '*',
  '6C',
  'JC',
  'QC',
  '3C',
  '*',
  '7C',
];

/** Once every player has passed, North holds the two and the ace of clubs. */
export const NORTH_TWO_TABLE = table(
  {
    white: '4C 5C 6C 7C 5D 6D 7D 5S 6S 7S 6H 7H 8H',
    black: '8C 9C TC 8D 9D TD JD 8S 9S TS 9H TH JH',
    red: '2C 3C AC 2D 3D 4D 2S 3S 4S 2H 3H 4H 5H',
    blue: 'JC QC KC QD KD AD JS QS KS AS QH KH AH',
  },
  '',
  { passed: 1 }
);

/** West holds no clubs, but the queen of spades, the ace of hearts and the ace of diamonds. */
export const WEST_VOID_TABLE = table(
  {
    white: '2C 3C 4C 5C 2D 3D 4D 2S 3S 4S 2H 3H 4H',
    black: 'AD KD QD JD TD QS KS JS TS AH KH QH JH',
    red: '6C 7C 8C 9C TC 5D 6D 7D 5S 6S 7S 5H 6H',
    blue: 'JC QC KC AC 8D 9D 8S 9S AS 7H 8H 9H TH',
  },
  '2C',
  { 'south led': 2 }
);

/** West holds only hearts, the ace among them, and the queen of spades. */
export const WEST_HEARTS_TABLE = table(
  {
    white: '2C 3C 4C 5C 6C 2D 3D 4D 5D 2S 3S 4S 2H',
    black: 'QS 3H 4H 5H 6H 7H 8H 9H TH JH QH KH AH',
    red: '7C 8C 9C TC JC 6D 7D 8D 9D 5S 6S 7S 8S',
    blue: 'QC KC AC TD JD QD KD AD 9S TS JS KS AS',
  },
  '2C',
  { 'south led': 2 }
);

/** West takes the first trick with the ace of clubs and leads the king to the second. */
export const WEST_LEADS_SECOND_TABLE = table(
  {
    white: '2C 3C 4C 2D 3D 4D 2S 3S 4S 2H 3H 4H 5H',
    black: 'AC KC QC AD KD QD KS JS TS AH KH QH JH',
    red: '5C 6C 7C 8C 5D 6D 7D 5S 6S 7S 6H 7H 8H',
    blue: '9C TC JC 8D 9D TD JD 8S 9S QS AS 9H TH',
  },
  '2C AC 5C 9C KC',
  { 'west led second': 6 }
);

/**
 * North takes the first two tricks with the ace and king of clubs and leads
 * the five to the third; East holds no clubs, and the ace of diamonds.
 */
export const NORTH_LEADS_THIRD_TABLE = table(
  {
    white: '2C 4C 6C 7C 4D 5D 6D 5S 6S 7S 7H 8H 9H',
    black: '3C 8C 9C TC JC QC 7D 8D 9D 8S 9S TS TH',
    red: 'AC KC 5C 2D 3D 2S 3S 4S 2H 3H 4H 5H 6H',
    blue: 'TD JD QD KD AD JS QS KS AS JH QH KH AH',
  },
  '2C 3C AC TD KC JD 4C 8C 5C',
  { 'north led third': 10 }
);

/**
 * West takes the first three tricks with the ace, king and queen of clubs
 * and leads the ten of diamonds to the fourth; North then plays the king of
 * diamonds and East, holding no diamonds, the ace of spades; South holds
 * the jack of diamonds.
 */
export const WEST_LEADS_FOURTH_TABLE = table(
  {
    white: '2C 3C 4C JD 2D 3D 5D 2S 3S 4S 2H 3H 4H',
    black: 'AC KC QC TD 9D 8D JS TS 9S AH KH QH JH',
    red: '5C 6C 7C 8C KD AD QD 4D 6D 7D 5S 6S 7S',
    blue: '9C TC JC 8S QS KS AS 5H 6H 7H 8H 9H TH',
  },
  '2C AC 5C 9C KC 6C TC 3C QC 7C JC 4C TD KD AS',
  { 'west led fourth': 14, 'north and east played': 16 }
);

/**
 * South takes the second, third and fourth tricks with the ace, king and
 * queen of diamonds and leads the fifth holding only clubs and hearts, the
 * ace among them; East plays the two of hearts to the third trick.
 */
export const HEARTS_BROKEN_TABLE = table(
  {
    white: '2C 3C 4C 5C 6C AD KD QD AH KH QH JH TH',
    black: 'AC 2D 3D 4D 8D 2S 3S 4S 5S 6S 3H 4H 5H',
    red: '7C 8C 9C 5D 6D 7D 9D TD JD 7S 8S 6H 7H',
    blue: 'TC JC QC KC 9S TS JS QS KS AS 2H 8H 9H',
  },
  '2C AC 7C TC 2D 5D 9S AD KD 3D 6D 2H QD 4D 7D TS',
  { 'south leads fifth': 17 }
);

/**
 * As above, but West plays the queen of spades to the third trick and no
 * heart is played before South leads the fifth.
 */
export const HEARTS_UNBROKEN_TABLE = table(
  {
    white: '2C 3C 4C 5C 6C AD KD QD AH KH QH JH TH',
    black: 'AC 2D QS 2S 3S 4S 5S 6S 7S 3H 4H 5H 6H',
    red: '7C 8C 9C 3D 4D 5D 6D 7D 8D 8S 9S 7H 8H',
    blue: 'TC JC QC KC 9D TD JD TS JS KS AS 2H 9H',
  },
  '2C AC 7C TC 2D 3D 9D AD KD QS 4D TD QD 2S 5D JD',
  { 'south leads fifth': 17 }
);

/** As above, but South leads the fifth trick holding only hearts, the five among them. */
export const SOUTH_HEARTS_TABLE = table(
  {
    white: '2C AD KD QD 5H 6H 7H 8H 9H TH JH QH KH',
    black: 'AC 2D QS 2S 3S 4S 5S 6S 7S 2H 3H 4H AH',
    red: '3C 4C 5C 6C 7C 8C 3D 4D 5D 6D 7D 8S 9S',
    blue: '9C TC JC QC KC 8D 9D TD JD TS JS KS AS',
  },
  '2C AC 3C 9C 2D 3D 8D AD KD QS 4D 9D QD 2S 5D TD',
  { 'south leads fifth': 17 }
);

/**
 * North takes every trick but the last two with clubs, West and East
 * throwing ten hearts on them; South takes the twelfth with the queen of
 * spades and the last with the ace, with three hearts: the deal scores
 * South 16, West 0, North 10 and East 0 once East plays the last card.
 */
export const SOUTH_SIXTEEN_TABLE = table(
  {
    white: '2C 3S 4S 5S 6S 7S 8S 9S TS JS QS KS AS',
    black: '3C 3D 4D 5D 6D 7D 8D 2H 3H 4H 5H 6H 7H',
    red: '4C 5C 6C 7C 8C 9C TC JC QC KC AC 2S 2D',
    blue: '9D TD JD QD KD AD 8H 9H TH JH QH KH AH',
  },
  [
    '2C 3C AC 9D',
    '4C TD 3S 3D',
    '5C JD 4S 4D',
    '6C QD 5S 5D',
    '7C KD 6S 6D',
    '8C AD 7S 7D',
    '9C 8H 8S 2H',
    'TC 9H 9S 3H',
    'JC TH TS 4H',
    'QC JH JS 5H',
    'KC QH KS 6H',
    '2S KH QS 7H',
    'AS 8D 2D',
  ].join(' '),
  { 'last card': 52 }
);

/** North holds every club and takes every trick: North shoots the moon. */
export const NORTH_MOON_TABLE = table(
  {
    white: '2D 3D 4D 5D 6D 7D 8D 9D TD JD QD KD AD',
    black: '2S 3S 4S 5S 6S 7S 8S 9S TS JS QS KS AS',
    red: '2C 3C 4C 5C 6C 7C 8C 9C TC JC QC KC AC',
    blue: '2H 3H 4H 5H 6H 7H 8H 9H TH JH QH KH AH',
  },
  [
    '2C 2H 2D 2S',
    '3C 3H 3D 3S',
    '4C 4H 4D 4S',
    '5C 5H 5D 5S',
    '6C 6H 6D 6S',
    '7C 7H 7D 7S',
    '8C 8H 8D 8S',
    '9C 9H 9D 9S',
    'TC TH TD TS',
    'JC JH JD JS',
    'QC QH QD QS',
    'KC KH KD KS',
    'AC AH AD',
  ].join(' '),
  { 'last card': 52 }
);

/**
 * North takes the first twelve tricks, with the queen of spades and every
 * heart but the two; East takes the last with the ace of diamonds and the
 * two of hearts, which West plays as the last card.
 */
export const NORTH_TWENTY_FIVE_TABLE = table(
  {
    white: '2C QS 3H 4D 5D 6D 7D 8D 9D TD JD QD KD',
    black: '2H 2S 3S 4S 5S 6S 7S 8S 9S TS JS KS AS',
    red: '3C 4C 5C 6C 7C 8C 9C TC JC QC KC AC 2D',
    blue: '3D AD 4H 5H 6H 7H 8H 9H TH JH QH KH AH',
  },
  [
    '2C 2S AC 3D',
    '3C 4H QS 3S',
    '4C 5H 3H 4S',
    '5C 6H 4D 5S',
    '6C 7H 5D 6S',
    '7C 8H 6D 7S',
    '8C 9H 7D 8S',
    '9C TH 8D 9S',
    'TC JH 9D TS',
    'JC QH TD JS',
    'QC KH JD KS',
    'KC AH QD AS',
    '2D AD KD',
  ].join(' '),
  { 'last card': 52 }
);
