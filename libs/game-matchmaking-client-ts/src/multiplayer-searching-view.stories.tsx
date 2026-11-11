import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MultiplayerScreenView } from './multiplayer-screen-view';
import {
  renderStory,
  SPEED_RATINGS,
  STORY_PARAMETERS,
  storyArgs,
} from './multiplayer-screen-view.example';

const meta = {
  id: 'screens-games-matchmaking-searching',
  title: 'Screens/Games/Matchmaking/Searching',
  component: MultiplayerScreenView,
  tags: ['autodocs'],
  parameters: STORY_PARAMETERS,
  render: (args) => renderStory()(args),
  args: {
    ...storyArgs(),
    stage: 'searching',
    place: { screen: 'searching' },
    ratings: SPEED_RATINGS,
    search: {
      players: 2,
      gameName: 'Connect Four',
      timeControl: '5+3',
      seconds: 42,
    },
  },
} satisfies Meta<typeof MultiplayerScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Searching: the time control, how long it has looked, and a way to stop. */
export const Searching: Story = {};

/** Searching for three other players of a game with no clock choices. */
export const SearchingForPlayers: Story = {
  args: {
    title: 'Hearts',
    goal: 'Take as few hearts as you can. The lowest score wins.',
    search: { players: 4, gameName: 'Hearts', timeControl: null, seconds: 7 },
  },
};

/** Offline: the search holds still until the connection returns. */
export const Offline: Story = { args: { online: false } };

/** Stopping was refused: the reason sits above the search, still under way. */
export const StopRefused: Story = {
  args: { error: 'Multiplayer game could not accept that command.' },
};

/** Stopping the search is its one command. */
export const Stop: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('multiplayer-stop'));
    await expect(args.onStop).toHaveBeenCalled();
  },
};
