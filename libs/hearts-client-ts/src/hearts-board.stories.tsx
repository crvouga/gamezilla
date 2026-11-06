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
import { createSignal } from 'solid-js';
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
// regression: hearts-phone-side-name-fragments
export const CardsOnTheirWay: Story = {
  args: { hand: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const name of ['jordan_plays', 'robin_42']) {
      const label = await canvas.findByText(name);
      const range = document.createRange();
      range.selectNodeContents(label);
      const lines = [...range.getClientRects()];
      await expect(lines.length).toBe(1);
      await expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
    }
  },
};

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

/** The three cards to pass, chosen in the story's hand. */
const PASSED = heldBy(DEAL.hands, 0).slice(0, 3);

/** Chooses the three cards to pass, as a person taps them. */
async function chooseThree(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  for (const card of PASSED)
    await userEvent.click(
      await canvas.findByTestId(`custom-game-board-card-${card}`)
    );
}

/**
 * Three cards chosen, the moment before passing: the filled Pass button
 * beside the count is ready to send them together.
 */
export const PassThreeCards: Story = {
  play: async ({ args, canvasElement }) => {
    await chooseThree(canvasElement);
    const pass = await within(canvasElement).findByTestId(
      'custom-game-board-pass'
    );
    await expect(pass).toBeEnabled();
    await expect(pass).toHaveAttribute('data-variant', 'solid');
    await expect(args.onAction).not.toHaveBeenCalled();
  },
};

/** The pass sent: the hand locks and the button says the cards are on their way. */
export const PassSending: Story = {
  play: async ({ args, canvasElement }) => {
    await chooseThree(canvasElement);
    await userEvent.click(
      await within(canvasElement).findByTestId('custom-game-board-pass')
    );
    await expect(args.onAction).toHaveBeenCalledWith(writeCards(PASSED));
  },
};

/** Four legal plays update the visible table and remove each played card. */
export const CompleteTrick: Story = {
  render: (args, context) => {
    const [table, setTable] = createSignal(playing(0));
    return renderGameTable(
      heartsPresentation,
      GAME_SIDES,
      {
        ...args,
        get position() {
          return encodeHearts(table().position);
        },
        get orientation() {
          return seatToMove(table()).side;
        },
        get hand() {
          return seatToMove(table()).hand;
        },
        onAction: (action) => {
          const current = table();
          const seat = seatToPlay(current.position);
          if (seat === null) throw new Error('Nobody is to play');
          const card = legalCards(
            current.position,
            seat,
            heldBy(current.hands, seat)
          ).find((candidate) => candidate === action);
          if (card === undefined) throw new Error('Illegal story action');
          setTable({
            position: {
              ...current.position,
              plays: [...current.position.plays, card],
            },
            hands: current.hands.map((hand, index) =>
              index === seat ? hand.filter((held) => held !== card) : hand
            ),
          });
        },
      },
      context
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (let count = 0; count < 4; count++) {
      const before = playing(count);
      const seat = seatToPlay(before.position);
      if (seat === null) throw new Error('Nobody is to play');
      const card = legalCards(
        before.position,
        seat,
        heldBy(before.hands, seat)
      )[0];
      if (card === undefined) throw new Error('No legal card');
      await userEvent.click(
        await canvas.findByTestId(`custom-game-board-card-${card}`)
      );
      await expect(canvas.getByTestId('custom-game-board')).toHaveAttribute(
        'data-position',
        encodeHearts(playing(count + 1).position)
      );
      await expect(
        canvas.queryByTestId(`custom-game-board-card-${card}`)
      ).toBeNull();
    }
    await expect(
      canvas.getByTestId('custom-game-board-center')
    ).toHaveTextContent('took the trick');
  },
};

/** Acknowledged passing preserves the chosen cards and closes the action. */
export const PassAcknowledged: Story = {
  render: (args, context) => {
    const [commitment, setCommitment] = createSignal<string | null>(null);
    return renderGameTable(
      heartsPresentation,
      GAME_SIDES,
      {
        ...args,
        get commitment() {
          return commitment();
        },
        get committed(): readonly GameSide[] {
          return commitment() === null ? [] : ['white'];
        },
        get interactive() {
          return commitment() === null;
        },
        onAction: setCommitment,
      },
      context
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await chooseThree(canvasElement);
    await userEvent.click(await canvas.findByTestId('custom-game-board-pass'));
    await expect(canvas.queryByTestId('custom-game-board-pass')).toBeNull();
    for (const card of PASSED) {
      await expect(
        canvas.getByTestId(`custom-game-board-card-${card}`)
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(
        canvas.getByTestId(`custom-game-board-card-${card}`)
      ).toHaveAttribute('aria-disabled', 'true');
    }
    await expect(
      canvas.getByTestId('custom-game-board-center')
    ).toHaveTextContent('Waiting for every player to pass');
  },
};
