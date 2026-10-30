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

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
