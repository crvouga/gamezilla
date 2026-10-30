import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MoveStrip } from './index';
import Example from './move-strip.example';

const meta = {
  title: 'Layouts/MoveStrip',
  component: MoveStrip,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
