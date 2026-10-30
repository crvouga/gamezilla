import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TileBoard } from './index';
import Example from './tile-board.example';

const meta = {
  id: 'product-tileboard',
  title: 'Games/Sokoban/Board',
  component: TileBoard,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
