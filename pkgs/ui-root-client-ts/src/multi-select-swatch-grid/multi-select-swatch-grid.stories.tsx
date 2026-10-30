import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MultiSelectSwatchGrid } from './index';
import Example from './multi-select-swatch-grid.example';

const meta = {
  id: 'components-inputs-multiselectswatchgrid',
  title: 'Molecules/MultiSelectSwatchGrid',
  component: MultiSelectSwatchGrid,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
