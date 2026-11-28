import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Nav } from './index';
import Example from './landmarks.example';

const meta = {
  id: 'primitives-landmarks',
  title: 'Atoms/Landmarks',
  component: Nav,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
