import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './embedded-frame.example';
import { EmbeddedFrame } from './index';

const meta = {
  title: 'Primitives/EmbeddedFrame',
  component: EmbeddedFrame,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
