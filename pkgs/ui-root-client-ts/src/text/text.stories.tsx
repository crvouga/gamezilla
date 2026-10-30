import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { P } from './index';
import Example from './text.example';

const meta = {
  id: 'primitives-text',
  title: 'Atoms/Text',
  component: P,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
