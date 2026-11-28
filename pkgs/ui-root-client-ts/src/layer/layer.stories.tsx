import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Layer } from './index';
import Example from './layer.example';

const meta = {
  id: 'layouts-layer',
  title: 'Atoms/Layer',
  component: Layer,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
