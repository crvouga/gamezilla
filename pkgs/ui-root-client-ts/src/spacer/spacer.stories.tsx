import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Spacer } from './index';
import Example from './spacer.example';

const meta = {
  title: 'Layouts/Spacer',
  component: Spacer,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
