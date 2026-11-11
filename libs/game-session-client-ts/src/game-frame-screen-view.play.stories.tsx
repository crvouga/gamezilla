import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { onBoard } from './game-frame-board.example';
import { FRAME_NO_PLAY } from './game-frame-empty';
import { GameFrameScreenView } from './game-frame-screen-view';
import {
  AVERY,
  BOT,
  FRAME_CONTROLS_EXCLUDE,
  frameArgs,
  FRAME_HELD as HELD,
  JORDAN,
  MID_GAME_MOVES,
  MID_GAME_RECORD,
  MORGAN,
  OPPONENT_TURN_MOVES,
  PEOPLE,
  FRAME_PLAYING as PLAYING,
  person,
  playSeat,
  record,
  seat,
  status,
  WATCHED_LINEUP,
  YOUR_TURN_MOVES,
  YOUR_TURN_RECORD,
} from './game-frame-story.example';

const meta = {
  id: 'screens-games-custom-play',
  title: 'Screens/Games/Custom game/Play',
  component: GameFrameScreenView,
  // A desktop frame is checked at a desktop window's height (1440x900).
  tags: ['autodocs', 'viewport-native-height'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: { ...frameArgs(), ...PLAYING },
  render: (args) => onBoard(MID_GAME_MOVES)(args),
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The viewer's turn ten drops in: their seat below the board says so, the
 * board takes a move, and the only command beside the board's own is Game
 * menu.
 */
export const YourTurn: Story = {
  args: { record: record(YOUR_TURN_RECORD) },
  render: (args) => onBoard(YOUR_TURN_MOVES)(args),
};

/** The viewer's turn early on: a short list of three moves each. */
export const EarlyTurn: Story = {
  args: { record: record(MID_GAME_RECORD.slice(0, 6)) },
  render: (args) => onBoard(MID_GAME_MOVES.slice(0, 6))(args),
};

/** Before the first move: the moves card says there are none yet. */
export const NoMovesYet: Story = {
  args: { record: record([]) },
  render: (args) => onBoard([])(args),
};

/**
 * The game this device watched begin: the versus card covers the board for
 * its count, the people who play on its two bands; a press goes to the board.
 */
export const Versus: Story = {
  args: { record: record([]), overlay: { kind: 'versus', count: 3 } },
  render: (args) => onBoard([])(args),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('custom-game-versus'));
    await expect(args.onOverlay).toHaveBeenCalledWith({ type: 'skip' });
    await expect(canvas.queryByTestId('custom-game-versus')).toBeNull();
  },
};

/** The versus card as it opens, still: the count at three. */
export const VersusCount: Story = {
  args: { record: record([]), overlay: { kind: 'versus', count: 3 } },
  render: (args) => onBoard([])(args),
};

/** The opponent's turn: the turn line is neutral and their strip is the active one. */
export const OpponentsTurn: Story = {
  render: (args) => onBoard(OPPONENT_TURN_MOVES)(args),
  args: {
    record: record(MID_GAME_RECORD.slice(0, 7)),
    status: status({
      description: 'Yellow diamond to move.',
      emphasis: 'neutral',
    }),
    table: {
      shape: 'strip',
      near: playSeat(AVERY),
      others: [playSeat(JORDAN, { deciding: true })],
    },
  },
};

/** A timed game: each seat carries its clock, the running one highlighted. */
export const Timed: Story = {
  args: {
    status: status({ minutes: 5, increment: 3 }),
    table: {
      shape: 'strip',
      near: playSeat(
        seat('white', person('avery'), 'avery', {
          value: '4:12',
          active: true,
        }),
        { deciding: true }
      ),
      others: [
        playSeat(
          seat('black', person('jordan'), 'jordan_plays', {
            value: '3:58',
            active: false,
          })
        ),
      ],
    },
  },
};

/** Playing a bot: the opponent's seat shows the bot and its level. */
export const AgainstBot: Story = {
  args: {
    status: status({
      lineup: 'Red circle: avery. Yellow diamond: Bot (medium).',
    }),
    table: {
      shape: 'strip',
      near: playSeat(AVERY, { deciding: true }),
      others: [playSeat(BOT)],
    },
  },
};

/** Someone in the space without a seat watches: the watching bar sits under everything. */
export const Watching: Story = {
  args: {
    viewerSide: null,
    watchers: 3,
    status: status({ lineup: WATCHED_LINEUP, emphasis: 'neutral' }),
    table: {
      shape: 'strip',
      near: playSeat(MORGAN, { deciding: true }),
      others: [playSeat(JORDAN)],
    },
    play: FRAME_NO_PLAY,
  },
};

/** A bigger table: the other seats sit above the board as a rail of chips. */
export const FourSeats: Story = {
  render: (args) => onBoard(MID_GAME_MOVES)(args),
  args: {
    playerCount: 4,
    status: status({
      lineup:
        'Red circle: avery. Yellow diamond: jordan_plays. Third seat: morgan. Fourth seat: Bot.',
      description: 'Secret choices: 2 of 4 made.',
    }),
    table: {
      shape: 'rail',
      near: playSeat(AVERY, { choosing: true, deciding: true }),
      others: [
        playSeat(JORDAN, {
          committed: true,
          stat: { label: 'Points', value: '12' },
        }),
        playSeat(seat('red', person('morgan'), 'morgan'), {
          committed: true,
          state: { kind: 'reconnecting', label: 'Away' },
        }),
        playSeat(seat('blue', { kind: 'bot' }, 'Bot'), {
          choosing: true,
          deciding: true,
          state: { kind: 'out', label: 'Out' },
        }),
      ],
    },
  },
};

/** A draw is on offer to the viewer: agreeing or declining is asked for right here. */
export const DrawOffered: Story = {
  args: {
    play: {
      ...FRAME_NO_PLAY,
      drawOffered: true,
      canAnswerDraw: true,
      canResign: true,
    },
  },
};

/** The opponent left: after a minute away the viewer may claim the win. */
export const OpponentAway: Story = {
  args: {
    table: {
      shape: 'strip',
      near: playSeat(AVERY, { deciding: true }),
      others: [
        playSeat(JORDAN, {
          state: { kind: 'reconnecting', label: 'Away' },
        }),
      ],
    },
    play: {
      ...FRAME_NO_PLAY,
      away: {
        person: PEOPLE.jordan,
        plainName: 'jordan_plays',
        twoSided: true,
      },
      canClaimWin: true,
      canResign: true,
    },
  },
};

/** A stand-in bot plays the viewer's side while they were away; they take it back. */
export const StandIn: Story = {
  args: {
    status: status({
      description: 'Red circle to move, played by a stand-in bot.',
    }),
    table: {
      shape: 'strip',
      near: playSeat(AVERY, { standIn: true, reclaim: true, deciding: true }),
      others: [playSeat(JORDAN)],
    },
  },
};

/** Offline with a game that needs the room: changes wait for the connection. */
export const ConnectionNeeded: Story = {
  args: { ...HELD, connection: 'needed' },
};

/** Offline with a solo game: it carries on on this device. */
export const OfflineLocal: Story = { args: { connection: 'offline-local' } };

/** A move made offline is held and played when the connection returns. */
export const MoveWaiting: Story = {
  args: {
    ...HELD,
    connection: 'waiting',
    status: status({ sending: true, emphasis: 'neutral' }),
  },
};

/**
 * A choice was refused: the reason sits with the game's commands, with no
 * dead end, and the board stays where it was.
 */
export const ChoiceRefused: Story = {
  args: { error: 'That move is not legal in this position.' },
};

/** The same game once the choice is retried and the refusal clears: the board has not moved. */
export const ChoiceRetried: Story = {};

/** The game's own engine stopped: the saved score is kept and reopening recovers. */
export const Stopped: Story = { args: { stopped: true } };

/** A long game lists only its latest moves; earlier ones are reached from the moves place. */
export const LongRecord: Story = {
  args: {
    record: record(
      Array.from({ length: 52 }, (_, index) => `m${String(index + 1)}`)
    ),
  },
};

/** Long names and a long refusal keep the seats and notices readable. */
export const LongContent: Story = {
  args: {
    error:
      'Every side makes its secret choice before play goes on. Wait for the other players, then try again.',
    table: {
      shape: 'strip',
      near: playSeat(
        seat(
          'white',
          person('avery'),
          'avery_the_extraordinarily_patient_strategist'
        ),
        { deciding: true }
      ),
      others: [
        playSeat(
          seat(
            'black',
            person('jordan'),
            'jordan_plays_every_single_evening_online'
          )
        ),
      ],
    },
  },
};

/** Game menu is the one way to every other command: it opens the commands place. */
export const OpenGameMenu: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('custom-game-commands'));
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'commands' });
    await expect(await canvas.findByTestId('custom-game-resign')).toBeVisible();
  },
};

/** Pressing a move in the list opens the moves place at that move; the live board is never rewound. */
export const OpenMove: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-review-move-3')
    );
    await expect(args.onSeek).toHaveBeenCalledWith(3);
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'moves' });
  },
};

/** Resigning from the play bar asks first, over the board: nothing is chosen yet. */
export const ResignAsked: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByTestId('custom-game-resign-now'));
    await canvas.findByText(/^This finishes the current game\./);
    await expect(
      await canvas.findByTestId('custom-game-resign-confirm')
    ).toBeVisible();
    await expect(args.onChoose).not.toHaveBeenCalled();
  },
};
