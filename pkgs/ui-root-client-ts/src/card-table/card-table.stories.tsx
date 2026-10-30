import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './card-table.example';
import { CardTable } from './index';

const meta = {
  title: 'Product/CardTable',
  component: CardTable,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
