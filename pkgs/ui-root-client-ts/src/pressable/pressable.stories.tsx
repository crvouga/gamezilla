import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Pressable } from './index';
import Example from './pressable.example';

const meta = {
  id: 'primitives-pressable',
  title: 'Atoms/Pressable',
  component: Pressable,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
