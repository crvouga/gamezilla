import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FrameStory } from './game-frame-board.example';
import { FRAME_CONTROLS_EXCLUDE, frameArgs } from './game-frame-story.example';
import { PlayBotsScreenView } from './play-bots-screen-view';
import { PlayFriendScreenView } from './play-friend-screen-view';

const meta = {
  id: 'screens-game-sessions-home',
  title: 'Screens/Space/Game sessions/Home',
  component: PlayFriendScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: frameArgs(),
  render: (args) => <FrameStory {...args} />,
} satisfies Meta<typeof PlayFriendScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No game yet: vs human, or vs bot. */
export const NoGame: Story = {};

/** No game yet, for a bigger game: the second choice plays against bots. */
export const NoGameManyPlayers: Story = {
  args: { sides: ['white', 'black', 'red', 'blue'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('game-session-create')).toBeVisible();
  },
};

/** No game yet, and the person may not create one: they wait for the creator. */
export const WaitingForCreator: Story = { args: { canCreate: false } };

/** Offline before a game: creating one needs the connection, and says so. */
export const ConnectionNeeded: Story = { args: { connection: 'needed' } };

/** Creating a game was refused: the reason stays on the screen with both ways to try again. */
export const ChoiceRefused: Story = {
  args: { error: 'The host is offline.' },
};

/** Someone who may not watch this space's games sees the way forward instead. */
export const Denied: Story = {
  args: {
    denial: {
      icon: KeyRoundIcon,
      title: 'Join this space to watch its games',
      body: 'Games in a space are for the people in it.',
      action: { label: 'Join space', onPress: fn() },
      dataSet: { testid: 'game-session-denial', reason: 'not_granted' },
    },
  },
};

/** Playing a bot is one press: the row sends the whole lineup and start. */
export const PlayBot: Story = {
  render: (args) => <PlayBotsScreenView {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('game-session-create'));
    await expect(args.onChoose).toHaveBeenCalledWith({
      operation: 'create',
      mode: 'vs-bot',
    });
  },
};

export const KingOfTheHill: Story = {
  parameters: {
    storyRoute: {
      pathname: '/space/story-room',
      tab: false,
      spaceBody: 'shell',
      spaceTitle: 'Quoridor: King of the Hill',
    },
  },
  args: {
    title: 'Quoridor: King of the Hill',
    goal: 'Reach the central hill first. Walls slow the others down.',
    sides: ['white', 'black', 'red', 'blue'],
  },
};
