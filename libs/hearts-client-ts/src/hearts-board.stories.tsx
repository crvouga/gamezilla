import {
  BOARD_CONTROLS_EXCLUDE,
  boardArgs,
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import { type Card, writeCards } from '@libs/hearts-shared-ts/hearts-cards';
import {
  dealFrom,
  shufflerFrom,
  twoOfClubsSeat,
} from '@libs/hearts-shared-ts/hearts-hidden';
import {
  encodeHearts,
  type HeartsPosition,
  INITIAL_HEARTS,
  seatAfter,
  seatOfSide,
  sideOfSeat,
} from '@libs/hearts-shared-ts/hearts-position';
import { legalCards, seatToPlay } from '@libs/hearts-shared-ts/hearts-tricks';
import {
  GAME_SIDES,
  type GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { HeartsBoard } from './hearts-board';
import { heartsPresentation } from './hearts-presentation';

/** One fixed deal: every story sees the same thirteen cards per seat. */
const DEAL = dealFrom(shufflerFrom([7, 11, 13, 17]));
const LEADER = twoOfClubsSeat(DEAL);

/** The cards `seat` holds in `hands`. */
function heldBy(
  hands: readonly (readonly Card[])[],
  seat: number
): readonly Card[] {
  return hands[seat] ?? [];
}

/**
 * The fourth deal (cards are held, nobody passes) after `count` cards, each
 * seat playing its first legal card, and what every seat still holds.
 */
function playing(count: number): {
  readonly position: HeartsPosition;
  readonly hands: readonly (readonly Card[])[];
} {
  let position: HeartsPosition = {
    deal: 4,
    phase: 'play',
    scores: [12, 30, 8, 28],
    lead: LEADER,
    plays: [],
    last: [0, 13, 0, 13],
  };
  const hands = DEAL.hands.map((hand) => [...hand]);
  for (let n = 0; n < count; n++) {
    const seat = seatToPlay(position);
    const card =
      seat === null
        ? undefined
        : legalCards(position, seat, heldBy(hands, seat))[0];
    if (seat === null || card === undefined) throw new Error('No card to play');
    hands[seat] = heldBy(hands, seat).filter((held) => held !== card);
    position = { ...position, plays: [...position.plays, card] };
  }
  return { position, hands };
}

/** The side to play in `table`, and the cards it holds. */
function seatToMove(table: ReturnType<typeof playing>): {
  readonly side: GameSide;
  readonly hand: string;
} {
  const seat = seatToPlay(table.position);
  if (seat === null) throw new Error('Nobody is to play');
  return {
    side: sideOfSeat(seat),
    hand: writeCards(heldBy(table.hands, seat)),
  };
}

/** Mid-trick on the fifth trick: someone has led, two follow. */
const MID_TRICK = playing(18);
const TO_MOVE = seatToMove(MID_TRICK);
/** The seat after the one to move: it waits its turn. */
const WAITING = sideOfSeat(seatAfter(seatOfSide(TO_MOVE.side), 1));
const TRICK_TAKEN = playing(20);
const SOUTH_HAND = writeCards(heldBy(DEAL.hands, 0));

const meta = {
  id: 'screens-games-hearts-board',
  title: 'Screens/Games/Hearts/Table',
  component: HeartsBoard,
  tags: ['autodocs'],
  render: (args, context) =>
    renderGameTable(heartsPresentation, GAME_SIDES, args, context),
  parameters: {
    appRouter: true,
    controls: { exclude: [...BOARD_CONTROLS_EXCLUDE] },
  },
  args: boardArgs(encodeHearts(INITIAL_HEARTS), {
    interactive: true,
    hand: SOUTH_HAND,
  }),
} satisfies Meta<typeof HeartsBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The first deal opens with every seat choosing three cards to pass left. */
export const Passing: Story = {};

/** The person has passed: their three cards stay marked while the others choose. */
export const PassedWaitingForOthers: Story = {
  args: {
    interactive: false,
    commitment: writeCards(heldBy(DEAL.hands, 0).slice(0, 3)),
    committed: ['white', 'red'],
  },
};

/** The person's turn mid-trick: cards that must follow suit are offered, the rest say why not. */
export const YourTurnToPlay: Story = {
  args: {
    position: encodeHearts(MID_TRICK.position),
    orientation: TO_MOVE.side,
    hand: TO_MOVE.hand,
  },
  parameters: { table: { turn: TO_MOVE.side } satisfies GameTableStory },
};

/** Another seat is playing: the hand is shown but nothing can be played. */
export const WaitingForTurn: Story = {
  args: {
    position: encodeHearts(MID_TRICK.position),
    orientation: WAITING,
    hand: writeCards(heldBy(MID_TRICK.hands, seatOfSide(WAITING))),
    interactive: false,
  },
  parameters: { table: { turn: TO_MOVE.side } satisfies GameTableStory },
};

/** A trick has just been taken: who took it, and with which card, until the next lead. */
export const TrickTaken: Story = {
  args: {
    position: encodeHearts(TRICK_TAKEN.position),
    hand: writeCards(heldBy(TRICK_TAKEN.hands, 0)),
    interactive: false,
  },
};

/** A seated player whose cards have not arrived is told so, not shown an empty hand. */
export const CardsOnTheirWay: Story = { args: { hand: null } };

/** A watcher sees the table and the trick, never a hand. */
export const Watching: Story = {
  args: {
    position: encodeHearts(MID_TRICK.position),
    hand: null,
    interactive: false,
  },
  parameters: { table: { viewer: null, turn: TO_MOVE.side } },
};

/** A score passed 100: the final scores, the lowest winning. */
export const GameOver: Story = {
  args: {
    position: encodeHearts({
      deal: 7,
      phase: 'done',
      scores: [42, 104, 38, 76],
      lead: null,
      plays: [],
      last: [0, 26, 0, 0],
    }),
    hand: null,
    interactive: false,
  },
  parameters: {
    table: {
      ending: { winner: 'red', reason: 'lowest score' },
    } satisfies GameTableStory,
  },
};

/** Choosing three cards readies the pass, which sends them together. */
export const PassThreeCards: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const chosen = heldBy(DEAL.hands, 0).slice(0, 3);
    for (const card of chosen)
      await userEvent.click(
        await canvas.findByTestId(`custom-game-board-card-${card}`)
      );
    await userEvent.click(await canvas.findByTestId('custom-game-board-pass'));
    await expect(args.onAction).toHaveBeenCalledWith(writeCards(chosen));
  },
};
