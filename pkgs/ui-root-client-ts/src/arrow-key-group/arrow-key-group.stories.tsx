import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './arrow-key-group.example';
import { ArrowKeyGroup } from './index';

const meta = {
  title: 'Primitives/ArrowKeyGroup',
  component: ArrowKeyGroup,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
