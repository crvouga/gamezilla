import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './chip-group.example';
import { ChipGroup } from './index';

const meta = {
  title: 'Components/Inputs/ChipGroup',
  component: ChipGroup,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
