import { sokobanPuzzleContent } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SokobanHistory } from './sokoban-history.example';
import { SokobanPlayer } from './sokoban-player';
import {
  playedTwoCrates,
  SOLVING_MOVES,
  TWO_CRATES,
} from './sokoban-player.example';

const meta = {
  id: 'screens-games-sokoban-puzzle',
  title: 'Screens/Games/Sokoban/Puzzle',
  component: SokobanPlayer,
  tags: ['autodocs'],
  // The player inside the screen a pack puzzle is played on.
  render: (args) => <SokobanHistory {...args} />,
  parameters: { appRouter: true, controls: { exclude: ['onAction'] } },
  args: {
    definition: TWO_CRATES,
    state: playedTwoCrates([]),
    disabled: false,
    onAction: fn(),
  },
} satisfies Meta<typeof SokobanPlayer>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The start: the worker beside two crates, two goals to fill. */
export const Fresh: Story = {};

/** One crate pushed onto its goal; moves and pushes counted. */
export const InProgress: Story = {
  args: { state: playedTwoCrates(SOLVING_MOVES.slice(0, 2)) },
};

/** Every crate on a goal. */
export const Solved: Story = {
  args: { state: playedTwoCrates(SOLVING_MOVES), disabled: false },
};

/** While the shared player is not taking moves, the board stays still. */
export const Disabled: Story = { args: { disabled: true } };

/** A puzzle this app cannot open points back to its overview. */
export const Unreadable: Story = { args: { definition: '{}' } };

/** Walking into the wall is refused, with the reason, and sends nothing. */
export const BlockedMove: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // regression: sokoban-desktop-blocked-move-pad
    (await canvas.findByTestId('sokoban-board')).focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(
      await canvas.findByTestId('sokoban-refusal')
    ).toHaveTextContent("The worker's way is blocked.");
    await expect(args.onAction).not.toHaveBeenCalled();
    // regression: sokoban-zero-moves-undo-guidance
    await expect(canvas.getByTestId('sokoban-refusal')).not.toHaveTextContent(
      'undo'
    );
  },
};

/** Real rule transitions from the first push to every crate on a goal. */
export const SolveWithKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    (await canvas.findByTestId('sokoban-board')).focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(await canvas.findByTestId('sokoban-refusal')).toBeVisible();
    for (const key of [
      'ArrowRight',
      'ArrowRight',
      'ArrowLeft',
      'ArrowLeft',
      'ArrowUp',
      'ArrowRight',
      'ArrowRight',
    ]) {
      await userEvent.keyboard(`{${key}}`);
    }
    await expect(await canvas.findByTestId('sokoban-counts')).toHaveAttribute(
      'data-moves',
      '7'
    );
    await expect(canvas.getByTestId('sokoban-counts')).toHaveAttribute(
      'data-pushes',
      '4'
    );
    await expect(canvas.getByText('Puzzle completed')).toHaveTextContent(
      'Puzzle completed'
    );
    await expect(
      canvas.queryByTestId('sokoban-refusal')
    ).not.toBeInTheDocument();
  },
};

const CORNER = JSON.stringify({
  format: 1,
  rows: ['######', '# $@.#', '#    #', '######'],
});
const cornerStart = sokobanPuzzleContent.rules.initial(CORNER);
if (!cornerStart.accepted) throw new Error('Invalid corner fixture');

/** Undo a crate pushed into a corner, restore it with redo, then recover and solve. */
export const CornerRecovery: Story = {
  args: { definition: CORNER, state: cornerStart.state },
  play: async ({ canvasElement }) => {
    // regression: sokoban-history-corner-recovery
    const canvas = within(canvasElement);
    const board = canvas.getByTestId('sokoban-board');
    board.focus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await expect(canvas.getByTestId('sokoban-refusal')).toBeVisible();
    await expect(canvas.getByTestId('sokoban-counts')).toHaveAttribute(
      'data-moves',
      '1'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Undo' }));
    await expect(canvas.getByTestId('sokoban-counts')).toHaveAttribute(
      'data-moves',
      '0'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Redo' }));
    await expect(canvas.getByTestId('sokoban-counts')).toHaveAttribute(
      'data-pushes',
      '1'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Undo' }));
    board.focus();
    await userEvent.keyboard(
      '{ArrowDown}{ArrowLeft}{ArrowLeft}{ArrowUp}{ArrowRight}{ArrowRight}'
    );
    await expect(canvas.getByText('Puzzle completed')).toBeVisible();
    await expect(canvas.getByTestId('sokoban-counts')).toHaveAttribute(
      'data-pushes',
      '2'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Restart' }));
    await expect(canvas.getByTestId('sokoban-counts')).toHaveAttribute(
      'data-moves',
      '0'
    );
    await expect(
      canvas.queryByText('Puzzle completed')
    ).not.toBeInTheDocument();
  },
};
