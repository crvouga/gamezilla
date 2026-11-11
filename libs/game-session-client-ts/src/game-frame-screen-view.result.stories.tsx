import { createSignal } from 'solid-js';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ConnectFourStoryBoard } from './connect-four-story-board.example';
import { FrameStory, onBoard } from './game-frame-board.example';
import { FRAME_NO_PLAY } from './game-frame-empty';
import { GameFrameScreenView } from './game-frame-screen-view';
import {
  AVERY,
  FRAME_CONTROLS_EXCLUDE,
  frameArgs,
  JORDAN,
  MID_GAME_RECORD,
  MORGAN,
  OPPONENT_TURN_MOVES,
  FRAME_OVER as OVER,
  FRAME_PLAYING as PLAYING,
  person,
  playSeat,
  record,
  STANDINGS,
  seat,
  status,
  WATCHED_LINEUP,
  WON_MOVES,
} from './game-frame-story.example';

const DRAWN_MOVES = '000000111111222222433333344444555555666666'
  .split('')
  .map(Number);

const meta = {
  id: 'screens-games-custom-result',
  title: 'Screens/Games/Custom game/Result',
  component: GameFrameScreenView,
  tags: ['autodocs', 'viewport-native-height'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: { ...frameArgs(), ...OVER },
  render: (args) => onBoard(WON_MOVES)(args),
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The viewer won: the headline is theirs, Rematch is the one filled command, then the final board and the standings. */
export const YouWin: Story = {};

/** The viewer lost at a scored table: their place, everyone's points and readiness. */
export const YouPlacedSecond: Story = {
  args: {
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
  render: (args) => onBoard(DRAWN_MOVES)(args),
  args: {
    status: status({ description: 'Game drawn.', emphasis: 'neutral' }),
    record: record(DRAWN_MOVES.map((column) => String(column + 1))),
    result: {
      headline: 'Draw',
      note: 'Host starts the rematch',
      scoreLabel: null,
      standings: [STANDINGS[0], { ...STANDINGS[1], place: 1 }],
    },
  },
};

/** A watcher reads who won and may go back to the space or review the moves. */
export const WatcherSeesResult: Story = {
  args: {
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
    phase: 'cancelled',
    record: record(MID_GAME_RECORD),
    status: status({ description: 'Game cancelled.', emphasis: 'neutral' }),
    next: { plays: true, canCreate: true, reviewable: false },
    result: null,
  },
};

/** Offline once the game is over: a rematch needs the connection, and the notice says so. */
export const ConnectionNeeded: Story = { args: { connection: 'needed' } };

/** A refused rematch says why, with every way forward still there. */
export const RematchRefused: Story = {
  args: { error: 'Only the host may start the rematch.' },
};

/** Review moves opens the moves place at the start of the game. */
export const OpenMoves: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-review-start')
    );
    await expect(args.onSeek).toHaveBeenCalledWith(0);
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'moves' });
  },
};

/**
 * A real transition, driven by the browser check of the completion: resigning
 * from the game menu is confirmed over it, the game finishes under the
 * dialog, and dismissing it leaves the result.
 */
export const FinishFromGameMenu: Story = {
  args: { ...PLAYING, place: { screen: 'commands' }, result: null },
  render: (args) => {
    const [finished, setFinished] = createSignal(false);
    return (
      <FrameStory
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
        onChoose={async (input) => {
          await args.onChoose(input);
          if (input.operation === 'resign') setFinished(true);
        }}
        board={
          <ConnectFourStoryBoard
            moves={OPPONENT_TURN_MOVES}
            interactive={false}
          />
        }
      />
    );
  },
};
