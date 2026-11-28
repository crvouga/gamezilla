import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './embedded-frame.example';
import { EmbeddedFrame } from './index';

const meta = {
  id: 'primitives-embeddedframe',
  title: 'Atoms/EmbeddedFrame',
  component: EmbeddedFrame,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
