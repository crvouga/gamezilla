import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { VisuallyHidden } from './index';
import Example from './visually-hidden.example';

const meta = {
  title: 'Primitives/VisuallyHidden',
  component: VisuallyHidden,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
