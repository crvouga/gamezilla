import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { VisuallyHidden } from './index';
import Example from './visually-hidden.example';

const meta = {
  id: 'primitives-visuallyhidden',
  title: 'Atoms/VisuallyHidden',
  component: VisuallyHidden,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
