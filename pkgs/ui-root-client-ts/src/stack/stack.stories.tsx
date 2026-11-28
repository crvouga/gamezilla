import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { StackVertical } from './index';
import Example from './stack.example';

const meta = {
  id: 'primitives-stack',
  title: 'Atoms/Stack',
  component: StackVertical,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
