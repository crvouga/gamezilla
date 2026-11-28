import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './chip-group.example';
import { ChipGroup } from './index';

const meta = {
  id: 'components-inputs-chipgroup',
  title: 'Molecules/ChipGroup',
  component: ChipGroup,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
