import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FrameStory } from './game-frame-board.example';
import { GameFrameScreenView } from './game-frame-screen-view';
import {
  FRAME_WITH_OPTIONS,
  HOST_OPTIONS,
} from './game-frame-setup-story.example';
import {
  FRAME_CONTROLS_EXCLUDE,
  frameArgs,
  setup,
} from './game-frame-story.example';

const meta = {
  id: 'screens-games-custom-clock',
  title: 'Screens/Games/Custom game/Clock',
  component: GameFrameScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: {
    ...frameArgs(),
    ...FRAME_WITH_OPTIONS,
    place: { screen: 'clock' },
  },
  render: (args) => <FrameStory {...args} />,
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The clock of a timed game: its minutes and added seconds, untimed, and swapping sides. */
export const TimedClock: Story = {};

/** An untimed game: the clock place says so, and untimed is the choice it holds. */
export const UntimedClock: Story = {
  args: {
    setup: setup(FRAME_WITH_OPTIONS.setup?.seats ?? [], {
      options: { ...HOST_OPTIONS, clock: { minutes: 0, increment: 0 } },
    }),
  },
};

/** Using a clock sends it and returns to the lobby. */
export const UseClock: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('custom-game-clock'));
    await expect(args.onChoose).toHaveBeenCalledWith({
      operation: 'clock',
      minutes: 5,
      increment: 3,
    });
    await expect(
      await canvas.findByTestId('custom-game-startable')
    ).toBeVisible();
  },
};
