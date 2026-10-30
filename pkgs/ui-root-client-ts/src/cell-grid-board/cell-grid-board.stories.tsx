import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './cell-grid-board.example';
import { CellGridBoard } from './index';

const meta = {
  id: 'product-cellgridboard',
  title: 'Games/Battleship/Board',
  component: CellGridBoard,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
