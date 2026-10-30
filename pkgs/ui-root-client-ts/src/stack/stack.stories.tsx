import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { StackVertical } from './index';
import Example from './stack.example';

const meta = {
  title: 'Primitives/Stack',
  component: StackVertical,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
