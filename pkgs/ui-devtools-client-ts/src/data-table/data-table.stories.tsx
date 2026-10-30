import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './data-table.example';
import { DataTable } from './index';
export default {
  title: 'Product/Developer tools/DataTable',
  component: DataTable,
  tags: ['autodocs'],
} satisfies Meta;
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
