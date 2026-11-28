import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { RadioGroup } from './index';
import Example from './radio-group.example';

const meta = {
  id: 'components-inputs-radiogroup',
  title: 'Atoms/RadioGroup',
  component: RadioGroup,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
