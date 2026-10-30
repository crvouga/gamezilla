import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Table } from './index';
import Example from './table.example';

const meta = {
  title: 'Primitives/Table',
  component: Table,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
