import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './chip.example';
import { Chip } from './index';

const meta = {
  id: 'components-data-display-chip',
  title: 'Molecules/Chip',
  component: Chip,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
