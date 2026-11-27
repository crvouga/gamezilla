import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PuzzleGrid } from './index';
import Example, { sequenceTiles } from './puzzle-grid.example';

const meta = {
  id: 'components-data-puzzlegrid',
  title: 'Molecules/PuzzleGrid',
  component: PuzzleGrid,
  tags: ['autodocs'],
} satisfies Meta<typeof PuzzleGrid>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A pack of thirty: three solved with a check, the fourth filled as next. */
export const Pack: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/** Nothing solved yet: the first puzzle is the one to play. */
export const Fresh: Story = {
  args: {
    label: 'Puzzles in Warehouse basics',
    tiles: sequenceTiles(12, 0),
  },
};

/** Every puzzle solved: checks throughout and no current tile. */
export const Finished: Story = {
  args: {
    label: 'Puzzles in Warehouse basics',
    tiles: sequenceTiles(12, 12),
  },
};
