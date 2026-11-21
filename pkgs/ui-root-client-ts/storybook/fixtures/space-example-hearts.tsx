/** @jsxImportSource solid-js */

import type { AvatarSeatColor } from '@pkgs/ui-root-client-ts/avatar';
import {
  CardTable,
  type CardTableCard,
  type CardTableHandCard,
  type CardTablePosition,
  type CardTableSeat,
} from '@pkgs/ui-root-client-ts/card-table';
import type { GameOptionFieldProps } from '@pkgs/ui-root-client-ts/game-option-field';
import type {
  SpaceGame,
  SpaceGameAction,
  SpaceGamePlay,
  SpaceGameSeat,
  SpacePerson,
  SpaceRole,
} from '@pkgs/ui-root-client-ts/space-types';
import type { JSX } from 'solid-js';

/**
 * Hearts as a space game: four players, two people and two bots filling
 * the empty seats, seven tricks into a deal. Spades were led (bob's Q♠,
 * Bot 1's 7♠, Bot 2's K♠) and it is your turn with one spade, the 3♠.
 * Deterministic: no timers, no randomness.
 */

/** The moment of the hand shown in game. */
export type HeartsExampleMoment = 'picked' | 'taking';

export type HeartsExampleOptions = {
  /** Read-only settings for a guest, the setup controls for the host. */
  viewer?: SpaceRole | undefined;
  /** `picked`: your turn, 3♠ picked. `taking`: the trick is being taken. */
  moment?: HeartsExampleMoment | undefined;
  /** Every action press, by its id (stories assert on it). */
  onAction?: ((id: string) => void) | undefined;
};

type Side = 'north' | 'west' | 'east' | 'south';

type SideFacts = {
  name: string;
  position: CardTablePosition;
  color: AvatarSeatColor;
  points: number;
};

const SIDES: Readonly<Record<Side, SideFacts>> = {
  north: { name: 'bob', position: 'top', color: 'player1', points: 12 },
  south: { name: 'You', position: 'bottom', color: 'player2', points: 5 },
  west: { name: 'Bot 1', position: 'left', color: 'player3', points: 20 },
  east: { name: 'Bot 2', position: 'right', color: 'player4', points: 3 },
};

/** The people row the Hearts examples are drawn with, viewer as a guest. */
export const HEARTS_EXAMPLE_PEOPLE: readonly SpacePerson[] = [
  {
    id: 'bob',
    kind: 'person',
    name: 'bob',
    host: true,
    initials: 'B',
    tintKey: 'bob',
  },
  {
    id: 'you',
    kind: 'person',
    name: 'You',
    you: true,
    initials: 'A',
    tintKey: 'you',
  },
  { id: 'bot-1', kind: 'bot', name: 'Bot 1' },
  { id: 'bot-2', kind: 'bot', name: 'Bot 2' },
];

const SIDE_OF_ID: Readonly<Record<string, Side>> = {
  bob: 'north',
  you: 'south',
  'bot-1': 'west',
  'bot-2': 'east',
};

const SUIT_SYMBOL: Readonly<Record<CardTableCard['suit'], string>> = {
  clubs: '♣',
  diamonds: '♦',
  spades: '♠',
  hearts: '♥',
};

const card = (
  rank: string,
  suit: CardTableCard['suit'],
  label: string
): CardTableCard => ({
  id: `${rank}${suit.slice(0, 1).toUpperCase()}`,
  rank,
  suit,
  suitName: suit,
  label,
});

const THREE_OF_SPADES = card('3', 'spades', 'Three of spades');

/** Your seven cards, sorted by suit then rank. */
const HAND: readonly CardTableCard[] = [
  card('2', 'clubs', 'Two of clubs'),
  card('9', 'clubs', 'Nine of clubs'),
  card('4', 'diamonds', 'Four of diamonds'),
  card('J', 'diamonds', 'Jack of diamonds'),
  THREE_OF_SPADES,
  card('5', 'hearts', 'Five of hearts'),
  card('10', 'hearts', 'Ten of hearts'),
];

/** The trick so far: spades led by bob. */
const TRICK: Readonly<Record<Side, CardTableCard | null>> = {
  north: card('Q', 'spades', 'Queen of spades'),
  west: card('7', 'spades', 'Seven of spades'),
  east: card('K', 'spades', 'King of spades'),
  south: null,
};

const PLAY_LABEL = `Play ${THREE_OF_SPADES.rank}${SUIT_SYMBOL[THREE_OF_SPADES.suit]}`;

function sideOf(person: SpacePerson): Side | undefined {
  if (person.you === true) return 'south';
  return SIDE_OF_ID[person.id];
}

function points(side: Side): string {
  return `${String(SIDES[side].points)} points`;
}

function tableSeats(moment: HeartsExampleMoment): readonly CardTableSeat[] {
  const sides: readonly Side[] = ['south', 'west', 'north', 'east'];
  return sides.map((side) => {
    const facts = SIDES[side];
    const played =
      side === 'south' && moment === 'taking' ? THREE_OF_SPADES : TRICK[side];
    const held = played === null ? HAND.length : HAND.length - 1;
    return {
      position: facts.position,
      name: side === 'south' ? 'You' : facts.name,
      facts: [`${String(held)} cards`, points(side)],
      active: side === 'south' && moment === 'picked',
      played,
      testId: `space-hearts-seat-${side}`,
    };
  });
}

function handCards(moment: HeartsExampleMoment): readonly CardTableHandCard[] {
  const held =
    moment === 'taking'
      ? HAND.filter((c) => c.id !== THREE_OF_SPADES.id)
      : HAND;
  return held.map((c) => {
    const playable = moment === 'picked' && c.suit === 'spades';
    return {
      ...c,
      enabled: playable,
      selected: moment === 'picked' ? c.id === THREE_OF_SPADES.id : null,
      refusal:
        playable || moment === 'taking'
          ? undefined
          : 'You must follow suit with a spade.',
    };
  });
}

function HeartsBoard(props: {
  moment: HeartsExampleMoment;
  status: string;
  onCard: (id: string) => void;
}): JSX.Element {
  return (
    <CardTable
      label="Hearts table"
      testId="space-hearts-table"
      center={props.status}
      centerSpokenOnly
      trick
      seats={tableSeats(props.moment)}
      hand={handCards(props.moment)}
      handLabel="Your hand"
      handWaiting={
        props.moment === 'taking' ? 'The trick is being taken' : undefined
      }
      cardTestId={(id) => `space-hearts-card-${id}`}
      onCard={props.onCard}
    />
  );
}

function playActions(
  moment: HeartsExampleMoment,
  press: (id: string) => void
): readonly SpaceGameAction[] {
  if (moment === 'taking') return [];
  return [
    { id: 'cancel', label: 'Cancel', onPress: () => press('cancel') },
    {
      id: 'play-card',
      label: PLAY_LABEL,
      emphasis: 'primary',
      onPress: () => press('play-card'),
    },
  ];
}

function seat(
  person: SpacePerson,
  moment: HeartsExampleMoment
): SpaceGameSeat | undefined {
  const side = sideOf(person);
  if (side === undefined) return undefined;
  const facts = SIDES[side];
  return {
    color: facts.color,
    turn: side === 'south' && moment === 'picked',
    data: {
      value: `${String(facts.points)} pts`,
      description: points(side),
    },
  };
}

function heartsPlay(
  moment: HeartsExampleMoment,
  press: (id: string) => void
): SpaceGamePlay {
  const status = moment === 'taking' ? 'Trick is in' : 'Your turn';
  return {
    status,
    detail: 'Hearts · trick 7 of 13',
    board: (
      <HeartsBoard
        moment={moment}
        status={status}
        onCard={(id) => press(`card-${id}`)}
      />
    ),
    actions: playActions(moment, press),
    waiting: 'The trick is being taken',
    seat: (person) => seat(person, moment),
  };
}

function heartsSettings(
  viewer: SpaceRole,
  press: (id: string) => void
): readonly GameOptionFieldProps[] {
  const readOnly = viewer === 'guest';
  return [
    {
      kind: 'choice',
      label: 'Players',
      readOnly,
      options: [{ value: '4', label: '4' }],
      value: '4',
      testId: 'space-hearts-players',
      onChange: () => press('players'),
    },
    {
      kind: 'choice',
      label: 'Bots',
      readOnly,
      options: [{ value: 'fill', label: '2 fill the empty seats' }],
      value: 'fill',
      testId: 'space-hearts-bots',
      onChange: () => press('bots'),
    },
  ];
}

/** Hearts as a `SpaceGame`, at one deterministic moment of a deal. */
export function heartsSpaceExample(
  options: HeartsExampleOptions = {}
): SpaceGame {
  const press = (id: string): void => options.onAction?.(id);
  return {
    key: 'hearts',
    name: 'Hearts',
    motif: 'cards',
    tagline: 'Avoid hearts and the queen of spades',
    players: { counts: [4], bots: true },
    setup: { settings: heartsSettings(options.viewer ?? 'guest', press) },
    play: heartsPlay(options.moment ?? 'picked', press),
  };
}
