import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { UnorderedList } from './index';
import Example from './semantic-list.example';

const meta = {
  title: 'Primitives/Semantic lists',
  component: UnorderedList,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
