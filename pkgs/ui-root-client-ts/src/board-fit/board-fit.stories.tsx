import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './board-fit.example';
import { BoardFit } from './index';

const meta = {
  title: 'Layouts/BoardFit',
  component: BoardFit,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
