import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TileBoard } from './index';
import Example from './tile-board.example';

const meta = {
  id: 'product-tileboard',
  title: 'Organisms/Games/Sokoban/Board',
  component: TileBoard,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
