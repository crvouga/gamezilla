import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './cell-grid-board.example';
import { CellGridBoard } from './index';

export default {
  id: 'organisms-games-gamequoridorboard',
  title: 'Games/Quoridor/Board',
  component: CellGridBoard,
  tags: ['autodocs'],
} satisfies Meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example boardTheme="quoridor" />,
};
