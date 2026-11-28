import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PickerSection } from './index';
import Example from './picker-section.example';

const meta = {
  id: 'components-inputs-pickersection',
  title: 'Molecules/PickerSection',
  component: PickerSection,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
