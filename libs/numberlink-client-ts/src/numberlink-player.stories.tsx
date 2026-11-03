import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { NumberlinkPlayer } from './numberlink-player';
import {
  FIVE_BY_FIVE,
  PATH_1,
  PATH_3,
  PATH_4,
  SOLUTION,
} from './numberlink-player.example';

/** Progress with `paths` drawn. */
function progress(paths: typeof SOLUTION): string {
  return JSON.stringify({ paths });
}

const meta = {
  id: 'screens-games-numberlink-puzzle',
  title: 'Screens/Games/Numberlink/Puzzle',
  component: NumberlinkPlayer,
  tags: ['autodocs'],
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
