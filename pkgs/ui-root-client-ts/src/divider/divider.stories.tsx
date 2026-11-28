import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './divider.example';
import { Divider } from './index';

const meta = {
  id: 'primitives-divider',
  title: 'Atoms/Divider',
  component: Divider,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
