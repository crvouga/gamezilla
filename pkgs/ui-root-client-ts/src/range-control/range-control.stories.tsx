import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { RangeControl } from './index';
import Example from './range-control.example';

const meta = {
  id: 'components-data-display-rangecontrol',
  title: 'Atoms/RangeControl',
  component: RangeControl,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
