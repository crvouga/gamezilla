import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './board-fit.example';
import { BoardFit } from './index';

const meta = {
  id: 'layouts-boardfit',
  title: 'Organisms/Games/Shared/GameBoardFit',
  component: BoardFit,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
