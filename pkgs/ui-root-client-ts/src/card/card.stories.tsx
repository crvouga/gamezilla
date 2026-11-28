import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './card.example';
import { Card } from './index';

const meta = {
  id: 'layouts-card',
  title: 'Atoms/Card',
  component: Card,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
