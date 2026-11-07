import {
  BOARD_CONTROLS_EXCLUDE,
  boardArgs,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import {
  encodeHearts,
  INITIAL_HEARTS,
} from '@libs/hearts-shared-ts/hearts-position';
import { GAME_SIDES } from '@pkgs/turn-game-shared-ts/game-rules';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { HeartsBoard } from './hearts-board';
import { heartsPresentation } from './hearts-presentation';

const meta = {
  id: 'screens-games-hearts-keyboard',
  title: 'Screens/Games/Hearts/Keyboard passing',
  component: HeartsBoard,
  render: (args, context) =>
    renderGameTable(heartsPresentation, GAME_SIDES, args, context),
  parameters: {
    appRouter: true,
    controls: { exclude: [...BOARD_CONTROLS_EXCLUDE] },
  },
  args: boardArgs(encodeHearts(INITIAL_HEARTS), {
    interactive: true,
    hand: '2C3C4C5C6C7C8C9CTCJCQCKCAC',
  }),
} satisfies Meta<typeof HeartsBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Select, revise and pass three cards using only the hand's keyboard controls. */
export const ChooseReviseAndPass: Story = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByTestId('custom-game-board-card-2C');
    await step('Enter the hand and select three cards', async () => {
      first.focus();
      await userEvent.keyboard(' {ArrowRight} {ArrowRight} ');
      for (const card of ['2C', '3C', '4C'])
        await expect(
          canvas.getByTestId(`custom-game-board-card-${card}`)
        ).toHaveAttribute('aria-pressed', 'true');
    });
    await step('Revise the selection before confirming', async () => {
      await userEvent.keyboard(' {End} ');
      await expect(
        canvas.getByTestId('custom-game-board-card-4C')
      ).toHaveAttribute('aria-pressed', 'false');
      await expect(
        canvas.getByTestId('custom-game-board-card-AC')
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(args.onAction).not.toHaveBeenCalled();
    });
    await step('Tab to the pass action and confirm once', async () => {
      await userEvent.tab();
      await expect(canvas.getByTestId('custom-game-board-pass')).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      await expect(args.onAction).toHaveBeenCalledExactlyOnceWith('2C3CAC');
      await expect(
        canvas.getByTestId('custom-game-board-pass')
      ).toHaveAttribute('aria-busy', 'true');
    });
  },
};
