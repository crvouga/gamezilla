import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { onBoard } from './game-frame-board.example';
import { GameFrameScreenView } from './game-frame-screen-view';
import {
  FRAME_GUEST,
  FRAME_WITH_OPTIONS,
} from './game-frame-setup-story.example';
import { FRAME_CONTROLS_EXCLUDE, frameArgs } from './game-frame-story.example';

const meta = {
  id: 'screens-games-custom-board',
  title: 'Screens/Games/Custom game/Board',
  component: GameFrameScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: {
    ...frameArgs(),
    ...FRAME_WITH_OPTIONS,
    place: { screen: 'board' },
  },
  render: (args) => onBoard([])(args),
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The board the game starts on, at its playing size, while the game is set up. */
export const BeforeTheGame: Story = {};

/** A seated guest sees the same board, facing their own side. */
export const AsAGuest: Story = { args: { ...FRAME_GUEST } };

/** The one command returns to the lobby, where the game is set up. */
export const BackToTheLobby: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId('custom-game-public')).toBeVisible();
    await userEvent.click(await canvas.findByTestId('custom-game-board-close'));
    await expect(
      await canvas.findByTestId('custom-game-board-open')
    ).toBeVisible();
  },
};
