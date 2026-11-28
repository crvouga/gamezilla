import { GameSetupModeContext } from '@libs/spaces-client-ts/game-setup-mode';
import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { CustomGameScreenView } from './custom-game-screen-view';
import { FrameStory } from './game-frame-board.example';
import { FRAME_CONTROLS_EXCLUDE, frameArgs } from './game-frame-story.example';

const meta = {
  id: 'screens-custom-games-home',
  title: 'Screens/Space/Custom games/Home',
  component: CustomGameScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: frameArgs(),
  render: (args) => <FrameStory {...args} />,
} satisfies Meta<typeof CustomGameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No game yet: play a bot at once, or set a game up with people. */
export const NoGame: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const name of [/Play a Friend/, /Play a bot/]) {
      const button = await canvas.findByRole('button', { name });
      const art = button.querySelector('img');
      if (art === null)
        throw new Error('The illustrated choice needs its artwork.');
      await art.decode();
      await expect(art.naturalWidth).toBeGreaterThan(0);
      await expect(art).toHaveAttribute('alt', '');
      await expect(art).toHaveAttribute('aria-hidden', 'true');
      await expect(art.getBoundingClientRect().width).toBe(32);
      await expect(button.scrollWidth).toBeLessThanOrEqual(
        button.clientWidth + 1
      );
    }
  },
};

/**
 * No game yet, for a bigger game: the quick start plays against bots. The
 * card is its words alone, at its whole width.
 */
// regression: mode-card-words-squeezed-without-picture
export const NoGameManyPlayers: Story = {
  args: { sides: ['white', 'black', 'red', 'blue'] },
  play: async ({ canvasElement }) => {
    const card = await within(canvasElement).findByTestId('custom-game-mode');
    const heading = within(card).getByRole('heading');
    // Literal input: Light Cycles Quad on a phone, whose words were set in
    // the 104px column kept for a picture it did not have.
    await expect(heading.getBoundingClientRect().width).toBeGreaterThan(
      card.getBoundingClientRect().width / 2
    );
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
  render: (args) => (
    <GameSetupModeContext
      value={{
        segments: [
          { key: 'classic', label: 'Classic' },
          { key: 'hill', label: 'King of the Hill' },
        ],
        selected: 'hill',
        onSelect: fn(),
      }}
    >
      <FrameStory {...args} />
    </GameSetupModeContext>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('radio', { name: 'King of the Hill' })
    ).toBeChecked();
  },
};
