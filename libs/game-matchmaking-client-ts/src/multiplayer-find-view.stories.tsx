import { ClockIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MultiplayerScreenView } from './multiplayer-screen-view';
import {
  renderStory,
  SPEED_RATINGS,
  STORY_FINISHED_GAME,
  STORY_PARAMETERS,
  storyArgs,
} from './multiplayer-screen-view.example';

const meta = {
  id: 'screens-games-matchmaking-find',
  title: 'Screens/Games/Matchmaking/Find an opponent',
  component: MultiplayerScreenView,
  tags: ['autodocs'],
  parameters: STORY_PARAMETERS,
  render: renderStory(),
  args: {
    ...storyArgs(),
    stage: 'idle',
    place: { screen: 'find' },
  },
} satisfies Meta<typeof MultiplayerScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

const TIMED = {
  title: 'Chess',
  find: { players: 2, timed: true, timeControl: '5+0' },
  ratings: SPEED_RATINGS,
} as const;

/** Before a search: find an opponent for a game without clock choices. */
export const FindOpponent: Story = {};

/** A first visit: nothing was ever sought here, so there is no game to return to. */
export const FirstVisit: Story = {
  args: { find: { players: 2, timed: false, timeControl: '5+0', fresh: true } },
};

/** A game with clock choices: the chosen clock is one row, one press from changing. */
export const FindTimed: Story = { args: TIMED };

/** A bigger game: find the other players, at the same clock choice. */
export const FindPlayers: Story = {
  args: {
    title: 'Hearts',
    find: { players: 4, timed: true, timeControl: '10+5' },
    ratings: SPEED_RATINGS,
  },
};

/** Searching while another game is unfinished: finish it first. */
export const FinishCurrentGameFirst: Story = {
  args: {
    commandDenial: {
      icon: ClockIcon,
      title: 'Finish your current game first',
      body: 'You can play one game at a time. Finish or leave it, then find another.',
      dataSet: {
        testid: 'multiplayer-command-denial',
        reason: 'limit_reached',
      },
    },
  },
};

/** A command was refused: the reason sits above with the search still on offer. */
export const CommandRefused: Story = {
  args: { error: 'Multiplayer game could not accept that command.' },
};

/** After a game: the search's hub is one row from the result, for another clock. */
export const AfterTheGame: Story = {
  args: { ...TIMED, stage: 'finished', game: STORY_FINISHED_GAME },
};

/** Offline: a search waits for the connection. */
export const Offline: Story = { args: { online: false } };

/** Long names and many players wrap inside their rows. */
export const LongContent: Story = {
  args: {
    title: 'Connect Four: the extended tournament edition',
    find: { players: 4, timed: true, timeControl: '15+10' },
    ratings: SPEED_RATINGS,
  },
};

/** Choosing a time control returns to the search with it, then finding an opponent at it. */
export const ChooseTimeControl: Story = {
  args: TIMED,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('multiplayer-open-time-control')
    );
    await userEvent.click(
      await canvas.findByTestId('multiplayer-time-control-3-2')
    );
    await expect(args.onChooseTimeControl).toHaveBeenCalledWith('3+2');
    await userEvent.click(await canvas.findByTestId('multiplayer-find'));
    await expect(args.onFind).toHaveBeenCalledWith('3+2');
  },
};

/** The ratings and the guide are each one row away, and Back returns. */
export const OpenRatings: Story = {
  args: TIMED,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('multiplayer-open-ratings')
    );
    await expect(args.onOpen).toHaveBeenCalledWith({
      screen: 'ratings',
      from: 'find',
    });
    await expect(
      await canvas.findByTestId('multiplayer-rating-blitz-value')
    ).toHaveTextContent('1623');
  },
};
