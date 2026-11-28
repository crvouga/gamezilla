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

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
