import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FrameStory } from './game-frame-board.example';
import { GameFrameScreenView } from './game-frame-screen-view';
import { FRAME_CONTROLS_EXCLUDE, frameArgs } from './game-frame-story.example';

const meta = {
  id: 'screens-games-custom-start',
  title: 'Screens/Games/Custom game/Start',
  component: GameFrameScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: frameArgs(),
  render: (args) => <FrameStory {...args} />,
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No game yet: play a bot at once, or set a game up with people. */
export const NoGame: Story = {};

/** No game yet, for a bigger game: the quick start plays against bots. */
export const NoGameManyPlayers: Story = { args: { playerCount: 4 } };

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
      dataSet: { testid: 'custom-game-denial', reason: 'not_granted' },
    },
  },
};

/** Playing a bot is one press: the row sends the whole lineup and start. */
export const PlayBot: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('custom-game-play-bot'));
    await expect(args.onPlayBot).toHaveBeenCalledTimes(1);
  },
};
