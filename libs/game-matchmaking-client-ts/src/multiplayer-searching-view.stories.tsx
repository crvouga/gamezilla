import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MatchmakingScreenView } from './matchmaking-screen-view';
import {
  renderStory,
  SPEED_RATINGS,
  STORY_PARAMETERS,
  storyArgs,
} from './matchmaking-screen-view.example';

const meta = {
  id: 'screens-matchmaking-searching',
  title: 'Screens/Space/Matchmaking/Searching',
  component: MatchmakingScreenView,
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
      motif: 'discs',
      goal: storyArgs().goal,
      timeControl: '5+3',
      seconds: 42,
    },
  },
} satisfies Meta<typeof MatchmakingScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Searching: the wait on the board's place, over the person's seat and chosen clock, and a way to stop. */
export const Searching: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 2, name: 'Searching…' })
    ).toBeVisible();
    await expect(
      canvas.getByTestId('multiplayer-waiting-clock')
    ).toHaveTextContent('5 min + 3 sec');
  },
};

/** Searching for three other players of a game with no clock choices. */
export const SearchingForPlayers: Story = {
  args: {
    title: 'Hearts',
    search: {
      goal: 'Take as few hearts as you can. The lowest score wins.',
      players: 4,
      gameName: 'Hearts',
      motif: 'cards',
      timeControl: null,
      seconds: 7,
    },
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
