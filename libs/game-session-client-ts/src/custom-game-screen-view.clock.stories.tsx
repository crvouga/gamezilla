import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { CustomGameScreenView } from './custom-game-screen-view';
import { FrameStory } from './game-frame-board.example';
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
  id: 'screens-custom-games-setup-clock',
  title: 'Screens/Space/Custom games/Setup clock',
  component: CustomGameScreenView,
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
} satisfies Meta<typeof CustomGameScreenView>;
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

/** A time is saved as its field is left: the screen has no separate save. */
export const SaveTimeOnLeave: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const minutes = await canvas.findByLabelText('Minutes per side');
    await userEvent.clear(minutes);
    await userEvent.type(minutes, '10');
    await userEvent.tab();
    await expect(args.onChoose).toHaveBeenCalledWith({
      operation: 'clock',
      minutes: 10,
      increment: 3,
    });
  },
};
