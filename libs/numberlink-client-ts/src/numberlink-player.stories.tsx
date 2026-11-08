import {
  StoryPackAttempt,
  type StoryPackPuzzle,
} from '@libs/game-puzzle-client-ts/content-attempt-story.example';
import { numberlinkPuzzleContent } from '@libs/numberlink-shared-ts/numberlink-puzzle-content';
import { createSignal } from 'solid-js';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { numberlinkContentFrame } from './numberlink-content-frame';
import {
  DENSE_NUMBERLINK,
  LONG_LABEL_NUMBERLINK,
} from './numberlink-extremes.example';
import { numberlinkGeometry } from './numberlink-geometry.example';
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
  return Object.entries(numberlinkContentFrame.stats).map(([key, label]) => ({
    key,
    label: label(),
    value: String(values[key] ?? 0),
  }));
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
      saving={args.disabled}
      complete={numberlinkPuzzleContent.rules.complete(
        args.definition,
        args.state
      )}
      figures={figures(args.definition, args.state)}
      figuresPlacement={numberlinkContentFrame.figuresPlacement}
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
export const Fresh: Story = {
  play: async ({ canvasElement }) => {
    // regression: numberlink-progress-detached-from-board
    await numberlinkGeometry(canvasElement);
  },
};

/** Matching labels remain the primary cue when every pair shares one color. */
export const SameColorPairs: Story = {
  args: {
    definition: JSON.stringify({
      ...FIVE_BY_FIVE,
      pairs: FIVE_BY_FIVE.pairs.map((pair) => ({ ...pair, color: 'blue' })),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const label of ['1', '2', '3', '4', '5']) {
      await expect(
        canvas.getAllByRole('button', {
          name: new RegExp(`endpoint ${label}, unfinished$`),
        })
      ).toHaveLength(2);
    }
  },
};

/** Two pairs joined and a third begun: joined pairs read as connected. */
export const InProgress: Story = {
  play: async ({ canvasElement }) => {
    // regression: numberlink-recovery-displaces-undo
    await numberlinkGeometry(canvasElement);
  },
  args: {
    state: progress([
      PATH_1,
      PATH_3,
      { pairId: 'pair-4', cells: PATH_4.cells.slice(0, 2) },
    ]),
  },
};

/** Every pair joined and every cell covered. */
// regression: solved-pack-story-completion
export const Solved: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByTestId('content-attempt-complete')
    ).toHaveTextContent('Completion saved');
  },
  args: { state: progress(SOLUTION), disabled: false },
  render: (args) => {
    const [next, setNext] = createSignal(false);
    return (
      <StoryPackAttempt
        puzzle={
          next()
            ? {
                ...PUZZLE,
                title: 'Five pairs practice',
                pack: { title: 'Linking practice', position: 3, total: 5 },
              }
            : PUZZLE
        }
        complete={!next()}
        next={{ title: 'Five pairs practice', open: () => setNext(true) }}
        player={
          <NumberlinkPlayer
            {...args}
            state={next() ? progress([]) : args.state}
          />
        }
      />
    );
  },
};

export const NextPuzzle: Story = {
  ...Solved,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('numberlink-solved')).toBeVisible();
    await userEvent.click(canvas.getByTestId('content-next-puzzle'));
    await expect(
      canvas.queryByTestId('numberlink-solved')
    ).not.toBeInTheDocument();
    await expect(canvas.getByTestId('numberlink-progress')).toHaveTextContent(
      '0/5 pairs connected'
    );
  },
};

/** While the shared player is not taking moves, nothing can be drawn. */
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByTestId('content-position-save-status')
    ).toHaveTextContent('Saving your position');
  },
};

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
export const DrawPaths: Story = {
  render: (args) => {
    const [state, setState] = createSignal(progress([]));
    return (
      <StoryPackAttempt
        puzzle={PUZZLE}
        figures={figures(args.definition, state())}
        figuresPlacement={numberlinkContentFrame.figuresPlacement}
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
};

/** Maximum dimensions retain the same real rules and interaction handlers. */
export const DenseBoard: Story = {
  ...DrawPaths,
  args: { definition: JSON.stringify(DENSE_NUMBERLINK) },
};

/** Long matching labels remain meaningful without distinct pair colors. */
export const LongLabels: Story = {
  ...DrawPaths,
  args: { definition: JSON.stringify(LONG_LABEL_NUMBERLINK) },
};

/** Complete a fresh attempt using keyboard input and real game rules. */
export const CompleteWithKeyboard: Story = {
  ...DrawPaths,
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
      canvas.queryByTestId('numberlink-drawing-status')
    ).not.toBeInTheDocument();
  },
};

/** Cancel, shorten, redraw and remove a path through pointer input and real rules. */
export const RecoverWithPointer: Story = {
  ...CompleteWithKeyboard,
  play: async ({ canvasElement }) => recoverWithPointer(canvasElement),
};

/** Keyboard and backtracking help is discoverable without crowding first use. */
export const DrawingHelp: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await numberlinkGeometry(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Drawing and keyboard help' })
    );
    await expect(canvas.getByTestId('numberlink-key-hints')).toBeVisible();
    await expect(
      canvas.getByText(/Start again at a number to redraw/)
    ).toBeVisible();
  },
};

/** Three removable paths share a bounded chooser rather than pushing Undo down. */
export const ChoosePathToRemove: Story = {
  ...InProgress,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await numberlinkGeometry(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Remove a path' })
    );
    const surface = within(document.body);
    for (const label of ['1', '3', '4']) {
      await expect(
        surface.getByRole('option', { name: `Remove path ${label}` })
      ).toBeVisible();
    }
  },
};
