import { sokobanPuzzleContent } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SokobanHistory } from './sokoban-history.example';
import { SokobanPlayer } from './sokoban-player';
import {
  DENSE_MAXIMUM_BOARD,
  MAXIMUM_BOARD,
  playedTwoCrates,
  SOLVING_MOVES,
  TWO_CRATES,
} from './sokoban-player.example';

const openLibrary = fn();

const meta = {
  id: 'screens-games-sokoban-puzzle',
  title: 'Screens/Games/Sokoban/Puzzle',
  component: SokobanPlayer,
  tags: ['autodocs'],
  // The player inside the screen a pack puzzle is played on.
  render: (args) => <SokobanHistory {...args} onOpenLibrary={openLibrary} />,
  parameters: {
    appRouter: true,
    test: { restoreMocks: false },
    controls: { exclude: ['onAction'] },
  },
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

const maximumStart = sokobanPuzzleContent.rules.initial(MAXIMUM_BOARD);
if (!maximumStart.accepted) throw new Error('Invalid maximum board fixture');

/** All 400 supported tiles, using the production board and movement rules. */
export const MaximumBoard: Story = {
  args: { definition: MAXIMUM_BOARD, state: maximumStart.state },
};

const denseStart = sokobanPuzzleContent.rules.initial(DENSE_MAXIMUM_BOARD);
if (!denseStart.accepted) throw new Error('Invalid dense board fixture');

/** The size limit, crowded with 36 crates and goals among pillars. */
export const DenseMaximumBoard: Story = {
  args: { definition: DENSE_MAXIMUM_BOARD, state: denseStart.state },
};

/** One crate pushed onto its goal; moves and pushes counted. */
export const InProgress: Story = {
  args: { state: playedTwoCrates(SOLVING_MOVES.slice(0, 2)) },
  play: async ({ canvasElement }) => {
    // regression: sokoban-story-restart-primary
    const restart = within(canvasElement).getByRole('button', {
      name: 'Restart',
    });
    await expect(restart).toHaveAttribute('data-intent', 'neutral');
    await expect(restart).toHaveAttribute('data-variant', 'outline');
  },
};

/** Every crate on a goal. */
// regression: solved-pack-story-completion
export const Solved: Story = {
  args: { state: playedTwoCrates(SOLVING_MOVES), disabled: false },
  play: async ({ canvasElement }) => {
    // regression: sokoban-solved-below-controls
    // Geometry is measured before a click can scroll the destination into view.
    const canvas = within(canvasElement);
    await expect(
      canvas.getByTestId('content-attempt-complete')
    ).toHaveTextContent('Completion saved');
    const notice = canvas.getByTestId('sokoban-solved').getBoundingClientRect();
    const pad = canvas.getByTestId('sokoban-move').getBoundingClientRect();
    await expect(notice.height).toBeGreaterThan(0);
    await expect(notice.top).toBeGreaterThanOrEqual(0);
    await expect(notice.bottom).toBeLessThanOrEqual(window.innerHeight);
    // The way on sits beside the pad, within the pad's row.
    await expect(notice.bottom).toBeLessThanOrEqual(pad.bottom);
    // A pack's puzzle: the screen offers the way on, so the board does not.
    await expect(
      canvas.queryByRole('button', { name: 'More puzzles' })
    ).toBeNull();
    await expect(
      canvas.getByRole('button', { name: 'Pack overview' })
    ).toBeVisible();
    // Completion must not disable the board or its movement controls.
    canvas.getByTestId('sokoban-board').focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvas.getByTestId('sokoban-counts')).toHaveAttribute(
      'data-moves',
      '8'
    );
  },
};

/** While the shared player is not taking moves, the board stays still. */
export const Disabled: Story = { args: { disabled: true } };

/** A puzzle this app cannot open points back to its overview. */
export const Unreadable: Story = {
  args: { definition: '{}' },
  play: async ({ canvasElement }) => {
    // regression: sokoban-unreadable-library-action
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'More puzzles' });
    const rect = button.getBoundingClientRect();
    await expect(rect.height).toBeGreaterThanOrEqual(44);
    await expect(rect.top).toBeGreaterThanOrEqual(0);
    await expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
    openLibrary.mockClear();
    await userEvent.click(button);
    await expect(openLibrary).toHaveBeenCalledTimes(1);
  },
};

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
    await expect(canvas.getByTestId('sokoban-solved')).toHaveTextContent(
      'All crates are on goals'
    );
    await expect(
      canvas.queryByTestId('sokoban-refusal')
    ).not.toBeInTheDocument();
  },
};

/** Letter-key movement, a blocked push, and recovery use the same real rules. */
export const LetterKeyRecovery: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const board = canvas.getByTestId('sokoban-board');
    board.focus();
    await userEvent.keyboard('a');
    await expect(canvas.getByTestId('sokoban-refusal')).toBeVisible();
    await userEvent.keyboard('dd');
    await expect(canvas.getByTestId('sokoban-counts')).toHaveAttribute(
      'data-pushes',
      '2'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Undo' }));
    await expect(canvas.getByTestId('sokoban-counts')).toHaveAttribute(
      'data-moves',
      '1'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Redo' }));
    await expect(canvas.getByTestId('sokoban-counts')).toHaveAttribute(
      'data-moves',
      '2'
    );
    board.focus();
    await userEvent.keyboard('aawdd');
    await expect(canvas.getByTestId('sokoban-solved')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Restart' }));
    await expect(canvas.getByTestId('sokoban-counts')).toHaveAttribute(
      'data-moves',
      '0'
    );
    await expect(
      canvas.queryByTestId('sokoban-solved')
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
    // regression: sokoban-history-stale-refusal
    await expect(
      canvas.queryByTestId('sokoban-refusal')
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Redo' }));
    await expect(
      canvas.queryByTestId('sokoban-refusal')
    ).not.toBeInTheDocument();
    await expect(canvas.getByTestId('sokoban-counts')).toHaveAttribute(
      'data-pushes',
      '1'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Undo' }));
    board.focus();
    await userEvent.keyboard(
      '{ArrowDown}{ArrowLeft}{ArrowLeft}{ArrowUp}{ArrowRight}{ArrowRight}'
    );
    await expect(canvas.getByTestId('sokoban-solved')).toBeVisible();
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
      canvas.queryByTestId('sokoban-solved')
    ).not.toBeInTheDocument();
    // As in production, the attempt is complete only while it is solved.
    await expect(canvas.queryByText('Completion saved')).toBeNull();
  },
};
