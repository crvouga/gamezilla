import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './icon.example';
import { Icon } from './index';

const meta = {
  id: 'primitives-icon',
  title: 'Atoms/Icon',
  component: Icon,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
