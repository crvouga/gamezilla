import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './card.example';
import { Card } from './index';

const meta = {
  title: 'Layouts/Card',
  component: Card,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
