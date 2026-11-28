import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './filter-bar.example';
import { FilterBar } from './index';

const meta = {
  id: 'components-data-display-filterbar',
  title: 'Molecules/FilterBar',
  component: FilterBar,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
