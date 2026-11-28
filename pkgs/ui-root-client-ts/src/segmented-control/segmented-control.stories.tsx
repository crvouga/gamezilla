import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SegmentedControl } from './index';
import Example from './segmented-control.example';

const meta = {
  id: 'components-inputs-segmentedcontrol',
  title: 'Molecules/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
