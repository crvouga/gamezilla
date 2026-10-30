import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PaginationControls } from './index';
import Example from './pagination-controls.example';

const meta = {
  title: 'Components/Data Display/PaginationControls',
  component: PaginationControls,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
