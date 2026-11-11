import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MultiplayerScreenView } from './multiplayer-screen-view';
import {
  renderStory,
  STORY_PARAMETERS,
  storyArgs,
} from './multiplayer-screen-view.example';

const meta = {
  id: 'screens-games-matchmaking-time-control',
  title: 'Screens/Games/Matchmaking/Time control',
  component: MultiplayerScreenView,
  tags: ['autodocs'],
  parameters: STORY_PARAMETERS,
  render: renderStory(),
  args: {
    ...storyArgs(),
    title: 'Chess',
    stage: 'idle',
    place: { screen: 'time-control' },
    find: { players: 2, timed: true, timeControl: '5+0' },
  },
} satisfies Meta<typeof MultiplayerScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every offered clock, by speed, the chosen one marked. */
export const Choices: Story = {};

/** A daily clock chosen: days for every move. */
export const DailyChosen: Story = {
  args: { find: { players: 2, timed: true, timeControl: '3d' } },
};

/** Offline: the clock can still be chosen; the notice sits above the choices. */
export const Offline: Story = { args: { online: false } };

/** Pressing a clock chooses it and returns to finding an opponent. */
export const Choose: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('multiplayer-time-control-10-0')
    );
    await expect(args.onChooseTimeControl).toHaveBeenCalledWith('10+0');
    await expect(await canvas.findByTestId('multiplayer-find')).toBeVisible();
  },
};
