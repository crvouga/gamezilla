import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MultiplayerScreenView } from './multiplayer-screen-view';
import {
  renderStory,
  STORY_GAME,
  STORY_PARAMETERS,
  storyArgs,
} from './multiplayer-screen-view.example';

const meta = {
  id: 'screens-games-matchmaking-private-setup',
  title: 'Screens/Games/Matchmaking/Private setup',
  component: MultiplayerScreenView,
  tags: ['autodocs'],
  parameters: STORY_PARAMETERS,
  render: renderStory({
    shown: 0,
    announcement: { title: 'Game in progress.' },
    setup: { status: 'Your private setup is incomplete.', choosing: true },
  }),
  args: {
    ...storyArgs(),
    title: 'Battleship',
    stage: 'setup',
    place: { screen: 'private-setup' },
    game: { ...STORY_GAME, leave: 'abort', flip: null, moves: null },
  },
} satisfies Meta<typeof MultiplayerScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Choosing: the person's own setup, its two commands and who is ready. */
export const Choosing: Story = {};

/** Chosen: waiting for the other player, with nothing left to arrange. */
export const Waiting: Story = {
  render: renderStory({
    shown: 0,
    announcement: { title: 'Game in progress.' },
    setup: { status: 'You are ready. Waiting for the other player.' },
  }),
};

/** A watcher sees who is ready, never a setup. */
export const Watching: Story = {
  render: renderStory({
    shown: 0,
    announcement: { title: 'Game in progress.' },
    setup: { status: 'The players are choosing their private setups.' },
  }),
  args: {
    game: { ...STORY_GAME, leave: null, draw: 'none', flip: null, moves: null },
  },
};

/** Offline: the setup holds still until the connection returns. */
export const Offline: Story = { args: { online: false } };

/** The game's commands are one press away while setups are chosen. */
export const OpenCommands: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('multiplayer-open-commands')
    );
    await expect(await canvas.findByTestId('multiplayer-abort')).toBeVisible();
  },
};
