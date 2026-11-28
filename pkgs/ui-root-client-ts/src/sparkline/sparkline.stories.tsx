import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Sparkline } from './index';
import Example from './sparkline.example';

const meta = {
  id: 'primitives-sparkline',
  title: 'Atoms/Sparkline',
  component: Sparkline,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
