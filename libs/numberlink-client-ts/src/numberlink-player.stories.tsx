import {
  StoryPackAttempt,
  type StoryPackPuzzle,
} from '@libs/game-puzzle-client-ts/content-attempt-story.example';
import { numberlinkPuzzleContent } from '@libs/numberlink-shared-ts/numberlink-puzzle-content';
import { createSignal } from 'solid-js';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { NumberlinkPlayer } from './numberlink-player';
import {
  FIVE_BY_FIVE,
  PATH_1,
  PATH_3,
  PATH_4,
  SOLUTION,
} from './numberlink-player.example';
import { recoverWithPointer } from './numberlink-pointer-recovery.example';

/** Progress with `paths` drawn. */
function progress(paths: typeof SOLUTION): string {
  return JSON.stringify({ paths });
}

/** The game's own figures for the attempt, as the app's panel shows them. */
function figures(definition: string, state: string) {
  const values = numberlinkPuzzleContent.statistics?.(definition, state) ?? {};
  return [
    { key: 'connectedPairs', label: 'Connected pairs' },
    { key: 'coveredCells', label: 'Covered cells' },
  ].map((figure) => ({ ...figure, value: String(values[figure.key] ?? 0) }));
}

/** A five-pair puzzle, as a person plays it from a pack. */
const PUZZLE: StoryPackPuzzle = {
  title: 'Five pairs',
  difficulty: 'Medium',
  description: 'Join each pair of numbers and fill every square.',
  pack: { title: 'Linking practice', position: 2, total: 5 },
};

const meta = {
  id: 'screens-games-numberlink-puzzle',
  title: 'Screens/Games/Numberlink/Puzzle',
  component: NumberlinkPlayer,
  tags: ['autodocs'],
  // The player inside the screen a pack puzzle is played on.
  render: (args) => (
    <StoryPackAttempt
      puzzle={PUZZLE}
      disabled={args.disabled}
      figures={figures(args.definition, args.state)}
      player={<NumberlinkPlayer {...args} />}
    />
  ),
  parameters: { appRouter: true, controls: { exclude: ['onAction'] } },
  args: {
    definition: JSON.stringify(FIVE_BY_FIVE),
    state: progress([]),
    disabled: false,
    onAction: fn(),
  },
} satisfies Meta<typeof NumberlinkPlayer>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A fresh attempt: only the numbered endpoints, every cell to fill. */
export const Fresh: Story = {};

/** Two pairs joined and a third begun: joined pairs read as connected. */
export const InProgress: Story = {
  args: {
    state: progress([
      PATH_1,
      PATH_3,
      { pairId: 'pair-4', cells: PATH_4.cells.slice(0, 2) },
    ]),
  },
};

/** Every pair joined and every cell covered. */
export const Solved: Story = {
  args: { state: progress(SOLUTION), disabled: true },
};

/** While the shared player is not taking moves, nothing can be drawn. */
export const Disabled: Story = { args: { disabled: true } };

/** A puzzle this app cannot open points back to its overview. */
export const Unreadable: Story = { args: { definition: '{}' } };

function movementKey(
  previous: { x: number; y: number },
  current: { x: number; y: number }
): string {
  if (current.x > previous.x) return 'ArrowRight';
  if (current.x < previous.x) return 'ArrowLeft';
  return current.y > previous.y ? 'ArrowDown' : 'ArrowUp';
}

/** Actual rule application feeds each committed gesture back into the player. */
export const CompleteWithKeyboard: Story = {
  render: (args) => {
    const [state, setState] = createSignal(progress([]));
    return (
      <StoryPackAttempt
        puzzle={PUZZLE}
        figures={figures(args.definition, state())}
        player={
          <NumberlinkPlayer
            {...args}
            state={state()}
            onAction={(action) => {
              const next = numberlinkPuzzleContent.rules.apply(
                args.definition,
                state(),
                action
              );
              if (!next.accepted) throw new Error('Story gesture was refused');
              setState(next.state);
            }}
          />
        }
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByRole('button', { name: /^A1: endpoint 1/ });
    first.focus();
    await userEvent.keyboard('{Enter}{ArrowRight}{Escape}');
    await expect(
      canvas.getByRole('button', { name: 'B1: empty' })
    ).toBeInTheDocument();
    first.focus();
    await userEvent.keyboard('{Enter}{ArrowRight}{Enter}{Delete}');
    await expect(
      canvas.getByRole('button', { name: 'B1: empty' })
    ).toBeInTheDocument();
    for (const path of SOLUTION) {
      const start = path.cells[0];
      if (!start) throw new Error('Missing path start');
      const coordinate = `${String.fromCharCode(65 + start.x)}${start.y + 1}`;
      canvas
        .getByRole('button', { name: new RegExp(`^${coordinate}:`) })
        .focus();
      await userEvent.keyboard('{Enter}');
      for (let index = 1; index < path.cells.length; index++) {
        const previous = path.cells[index - 1];
        const current = path.cells[index];
        if (!previous || !current) throw new Error('Missing path cell');
        const key = movementKey(previous, current);
        await userEvent.keyboard(`{${key}}`);
      }
      await userEvent.keyboard('{Enter}');
      await expect(
        canvas.getByRole('button', {
          name: new RegExp(`^${coordinate}: endpoint .* connected$`),
        })
      ).toBeInTheDocument();
    }
    // regression: numberlink-solved-keeps-drawing-hints
    await expect(canvas.getByTestId('numberlink-solved')).toHaveTextContent(
      'Puzzle solved'
    );
    await expect(
      canvas.queryByText('Drag from a number to its match.')
    ).not.toBeInTheDocument();
  },
};

/** Cancel, shorten, redraw and remove a path through pointer input and real rules. */
export const RecoverWithPointer: Story = {
  ...CompleteWithKeyboard,
  play: async ({ canvasElement }) => recoverWithPointer(canvasElement),
};
