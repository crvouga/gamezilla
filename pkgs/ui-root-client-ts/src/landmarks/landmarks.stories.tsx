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

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
