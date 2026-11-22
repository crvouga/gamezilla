import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './data-table.example';
import { DataTable } from './index';
export default {
  id: 'product-developer-tools-datatable',
  title: 'Organisms/Devtools/DataTable',
  component: DataTable,
  tags: ['autodocs'],
} satisfies Meta;
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
