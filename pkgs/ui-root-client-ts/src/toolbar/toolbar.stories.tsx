import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Toolbar } from './index';
import Example from './toolbar.example';

const meta = {
  title: 'Layouts/Toolbar',
  component: Toolbar,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
