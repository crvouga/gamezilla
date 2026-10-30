import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './collection-screen.example';
import { CollectionScreen } from './index';

const meta = {
  title: 'Templates/Search and collections',
  component: CollectionScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
