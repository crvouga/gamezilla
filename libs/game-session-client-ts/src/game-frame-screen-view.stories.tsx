import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { createSignal } from 'solid-js';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ConnectFourStoryBoard } from './connect-four-story-board.example';
import { onBoard } from './game-frame-board.example';
import { FRAME_NO_PLAY } from './game-frame-empty';
import type { GameFrameScreenViewProps } from './game-frame-screen-view';
import { GameFrameScreenView } from './game-frame-screen-view';
import {
  AVERY,
  BOT,
  FRAME_CONTROLS_EXCLUDE,
  frameArgs,
  JORDAN,
  MID_GAME_MOVES,
  MID_GAME_RECORD,
  MORGAN,
  PEOPLE,
  FRAME_PLAYING as PLAYING,
  person,
  playSeat,
  record,
  STANDINGS,
  seat,
  status,
  WATCHED_LINEUP,
  WON_MOVES,
  WON_RECORD,
  YOUR_TURN_MOVES,
  YOUR_TURN_RECORD,
} from './game-frame-story.example';

const meta = {
  id: 'screens-games-frame',
  title: 'Screens/Games/Frame/Game frame',
  component: GameFrameScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: frameArgs(),
  render: (args) => onBoard(MID_GAME_MOVES)(args),
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The viewer's turn ten drops in: their seat below the board glows, the
 * board takes a move, and the record holds five moves each.
 */
export const YourTurn: Story = {
  args: { ...PLAYING, record: record(YOUR_TURN_RECORD) },
  render: (args) => onBoard(YOUR_TURN_MOVES)(args),
};

/** Red circle moves first, so after six drops it is the viewer's turn again. */
const EARLY_MOVES = MID_GAME_MOVES.slice(0, 6);

/** The viewer's turn early on: a short record of three moves each. */
export const EarlyTurn: Story = {
  args: { ...PLAYING, record: record(MID_GAME_RECORD.slice(0, 6)) },
  render: (args) => onBoard(EARLY_MOVES)(args),
};

/** The opponent's turn: the turn line is neutral and their strip is the active one. */
export const OpponentsTurn: Story = {
  args: {
    ...PLAYING,
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
    ...PLAYING,
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
    ...PLAYING,
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
    ...PLAYING,
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
  render: (args) => <GameFrameScreenView {...args} />,
  args: {
    ...PLAYING,
    playerCount: 4,
    status: status({
      lineup:
        'Red circle: avery. Yellow diamond: jordan_plays. Third seat: morgan. Fourth seat: Bot.',
      description: 'Every side chooses in secret: 2 of 4 have chosen.',
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
          state: { kind: 'reconnecting', label: 'Reconnecting' },
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

/** A draw is on offer to the viewer: they may agree or decline. */
export const DrawOffered: Story = {
  args: {
    ...PLAYING,
    play: {
      ...FRAME_NO_PLAY,
      drawOffered: true,
      canAnswerDraw: true,
      canResign: true,
    },
  },
};

/** The viewer declined a draw: they may offer one again after their next move. */
export const DrawDeclined: Story = {
  args: {
    ...PLAYING,
    play: { ...FRAME_NO_PLAY, offerAgainLater: true, canResign: true },
  },
};

/** The opponent left: after a minute away the viewer may claim the win. */
export const OpponentAway: Story = {
  args: {
    ...PLAYING,
    table: {
      shape: 'strip',
      near: playSeat(AVERY, { deciding: true }),
      others: [
        playSeat(JORDAN, {
          state: { kind: 'reconnecting', label: 'Reconnecting' },
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
    ...PLAYING,
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
  args: { ...PLAYING, connection: 'needed' },
};

/** Offline with a solo game: it carries on on this device. */
export const OfflineLocal: Story = {
  args: { ...PLAYING, connection: 'offline-local' },
};

/** A move made offline is held and played when the connection returns. */
export const MoveWaiting: Story = {
  args: {
    ...PLAYING,
    connection: 'waiting',
    status: status({ sending: true }),
  },
};

/** A choice was refused: the reason sits above the game with no dead end. */
export const ChoiceRefused: Story = {
  args: {
    ...PLAYING,
    error: 'That move is not legal in this position.',
  },
};

/** The game's own engine stopped: the saved score is kept and reopening recovers. */
export const Stopped: Story = { args: { ...PLAYING, stopped: true } };

/** Reviewing an earlier move: the record marks it, the board shows that position, and the line by the board says which move with a Back to live step. */
export const ReviewingEarlierMove: Story = {
  render: (args) => onBoard(MID_GAME_MOVES.slice(0, 3))(args),
  args: {
    ...PLAYING,
    record: { ...record(MID_GAME_RECORD), displayedPly: 3 },
  },
};

/** An earlier game of this space chosen from the record, with a refused jump. */
export const EarlierGameRecord: Story = {
  args: {
    ...PLAYING,
    record: {
      ...record(MID_GAME_RECORD),
      earlier: ['game-2', 'game-1'],
      selection: 'game-1',
      error: 'Choose a position from the moves actually played.',
    },
  },
};

/** A long game lists only its latest moves; earlier ones are reached by number. */
export const LongRecord: Story = {
  args: {
    ...PLAYING,
    record: record(
      Array.from({ length: 52 }, (_, index) => `m${String(index + 1)}`)
    ),
  },
};

const OVER: Partial<GameFrameScreenViewProps> = {
  phase: 'completed',
  viewerSide: 'white',
  status: status({
    description: 'Red circle wins by four in a row.',
    emphasis: 'neutral',
  }),
  table: { shape: 'strip', near: playSeat(AVERY), others: [playSeat(JORDAN)] },
  play: FRAME_NO_PLAY,
  next: { plays: true, canCreate: true, reviewable: true },
  record: record(WON_RECORD),
};

/** The viewer won: the headline is theirs, then the standings and what comes next. */
export const YouWin: Story = {
  render: (args) => onBoard(WON_MOVES)(args),
  args: {
    ...OVER,
    result: {
      headline: 'You win',
      note: 'Host starts the rematch',
      scoreLabel: null,
      standings: STANDINGS,
    },
  },
};

/** A frame-only long completed record keeps next choices ahead of the record. */
export const FinishedLongRecord: Story = {
  ...YouWin,
  args: {
    ...YouWin.args,
    record: record(Array.from({ length: 52 }, (_, index) => `m${index + 1}`)),
  },
};

/** The viewer lost at a scored table: their place, everyone's points and readiness. */
export const YouPlacedSecond: Story = {
  render: (args) => onBoard(WON_MOVES)(args),
  args: {
    ...OVER,
    // The signed-in viewer (avery) holds Yellow diamond and came second.
    viewerSide: 'black',
    table: {
      shape: 'strip',
      near: playSeat(seat('black', person('avery'), 'avery')),
      others: [playSeat(seat('white', person('jordan'), 'jordan_plays'))],
    },
    next: { plays: true, canCreate: false, reviewable: true },
    result: {
      headline: 'You came 2nd',
      note: null,
      scoreLabel: 'Points',
      standings: [
        {
          ...STANDINGS[0],
          name: 'jordan_plays',
          holder: person('jordan'),
          you: false,
          score: '26',
          readiness: { label: 'Ready', ready: true },
        },
        {
          ...STANDINGS[1],
          name: 'avery',
          holder: person('avery'),
          you: true,
          score: '19',
          readiness: { label: 'Not yet', ready: false },
        },
      ],
    },
  },
};

/** A drawn game: everyone shares first place. */
export const Draw: Story = {
  render: (args) =>
    onBoard('000000111111222222433333344444555555666666'.split('').map(Number))(
      args
    ),
  args: {
    ...OVER,
    status: status({ description: 'Game drawn.', emphasis: 'neutral' }),
    record: record(
      '000000111111222222433333344444555555666666'
        .split('')
        .map((column) => String(Number(column) + 1))
    ),
    result: {
      headline: 'Draw',
      note: 'Host starts the rematch',
      scoreLabel: null,
      standings: [STANDINGS[0], { ...STANDINGS[1], place: 1 }],
    },
  },
};

/** A watcher reads who won and may go back to the space or review the game. */
export const WatcherSeesResult: Story = {
  render: (args) => onBoard(WON_MOVES)(args),
  args: {
    ...OVER,
    viewerSide: null,
    status: status({
      lineup: WATCHED_LINEUP,
      description: 'Red circle wins by four in a row.',
      emphasis: 'neutral',
    }),
    table: {
      shape: 'strip',
      near: playSeat(MORGAN),
      others: [playSeat(JORDAN)],
    },
    next: { plays: false, canCreate: false, reviewable: true },
    result: {
      headline: 'morgan wins',
      note: 'Host starts the rematch',
      scoreLabel: null,
      standings: [
        {
          ...STANDINGS[0],
          name: 'morgan',
          holder: person('morgan'),
          you: false,
        },
        STANDINGS[1],
      ],
    },
  },
};

/** A cancelled game: no result, and the host may set up the next one. */
export const Cancelled: Story = {
  args: {
    ...OVER,
    phase: 'cancelled',
    record: record(MID_GAME_RECORD),
    status: status({ description: 'Game cancelled.', emphasis: 'neutral' }),
    next: { plays: true, canCreate: true, reviewable: false },
  },
};

/** Long names and a long refusal keep the seats and notices readable. */
export const LongContent: Story = {
  args: {
    ...PLAYING,
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

/** Someone who may not watch this space's games sees the way forward instead. */
export const Denied: Story = {
  args: {
    denial: {
      icon: KeyRoundIcon,
      title: 'Join this space to watch its games',
      body: 'Games in a space are for the people in it.',
      action: { label: 'Join space', onPress: fn() },
      dataSet: { testid: 'custom-game-denial', reason: 'not_granted' },
    },
  },
};

/** Resigning asks first: the question, with nothing chosen yet. */
export const ConfirmResign: Story = {
  args: PLAYING,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByTestId('custom-game-resign'));
    await canvas.findByText(/^This finishes the current game\./);
    await expect(args.onChoose).not.toHaveBeenCalled();
  },
};

/** Confirming finishes the game with its record kept. */
export const ResignConfirmed: Story = {
  args: PLAYING,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByTestId('custom-game-resign'));
    await userEvent.click(
      await canvas.findByTestId('custom-game-resign-confirm')
    );
    await expect(args.onChoose).toHaveBeenCalledWith({ operation: 'resign' });
  },
};

/** A real frame transition preserves the confirmation and then supports review. */
export const FinishAndReview: Story = {
  args: PLAYING,
  render: (args) => {
    const [finished, setFinished] = createSignal(false);
    const [ply, setPly] = createSignal(MID_GAME_RECORD.length);
    return (
      <GameFrameScreenView
        {...args}
        phase={finished() ? 'completed' : 'active'}
        play={finished() ? FRAME_NO_PLAY : args.play}
        status={status({
          description: finished()
            ? 'Yellow diamond wins by resignation.'
            : 'Yellow diamond to move.',
          emphasis: 'neutral',
        })}
        table={{
          shape: 'strip',
          near: playSeat(AVERY),
          others: [playSeat(JORDAN, { deciding: !finished() })],
        }}
        next={{ plays: true, canCreate: true, reviewable: true }}
        result={
          finished()
            ? {
                headline: 'You came 2nd',
                note: 'You resigned.',
                scoreLabel: null,
                standings: [
                  { ...STANDINGS[1], place: 1 },
                  { ...STANDINGS[0], place: 2 },
                ],
              }
            : null
        }
        record={
          finished()
            ? { ...record(MID_GAME_RECORD), displayedPly: ply() }
            : args.record
        }
        onChoose={async (input) => {
          if (input.operation === 'resign') setFinished(true);
        }}
        onSeek={setPly}
        onReturnLive={() => setPly(MID_GAME_RECORD.length)}
        board={
          <ConnectFourStoryBoard
            moves={finished() ? MID_GAME_MOVES.slice(0, ply()) : MID_GAME_MOVES}
            interactive={false}
          />
        }
      />
    );
  },
};
