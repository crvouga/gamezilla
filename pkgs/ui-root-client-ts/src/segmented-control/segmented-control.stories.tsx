import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SegmentedControl } from './index';
import Example from './segmented-control.example';

const meta = {
  title: 'Components/Inputs/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
