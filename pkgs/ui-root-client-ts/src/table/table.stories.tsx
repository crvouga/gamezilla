import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Table } from './index';
import Example from './table.example';

const meta = {
  id: 'primitives-table',
  title: 'Atoms/Table',
  component: Table,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
