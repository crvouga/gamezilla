import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './divider.example';
import { Divider } from './index';

const meta = {
  title: 'Primitives/Divider',
  component: Divider,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
