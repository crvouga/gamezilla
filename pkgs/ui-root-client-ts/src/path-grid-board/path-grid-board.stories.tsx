import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PathGridBoard } from './index';
import Example from './path-grid-board.example';

const meta = {
  title: 'Product/PathGridBoard',
  component: PathGridBoard,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
