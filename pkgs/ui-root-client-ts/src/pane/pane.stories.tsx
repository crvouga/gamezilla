import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Pane } from './index';
import Example from './pane.example';

const meta = {
  id: 'layouts-pane',
  title: 'Molecules/Pane',
  component: Pane,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
