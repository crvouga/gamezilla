import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './heading.example';
import { H1 } from './index';

const meta = {
  title: 'Primitives/Heading',
  component: H1,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
