import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Toolbar } from './index';
import Example from './toolbar.example';

const meta = {
  id: 'layouts-toolbar',
  title: 'Organisms/Toolbar',
  component: Toolbar,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
