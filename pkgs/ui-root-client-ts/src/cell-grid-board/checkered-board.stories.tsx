import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './checkered-board.example';
import { CellGridBoard } from './index';

export default {
  id: 'organisms-games-checkeredboard',
  title: 'Games/Checkered/Board',
  component: CellGridBoard,
  tags: ['autodocs'],
} satisfies Meta;

/** Wooden squares, pieces that fill most of a square, labels outside the squares. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
