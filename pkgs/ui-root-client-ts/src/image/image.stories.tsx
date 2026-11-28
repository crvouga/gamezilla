import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './image.example';
import { Image } from './index';

const meta = {
  id: 'primitives-image',
  title: 'Atoms/Image',
  component: Image,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
