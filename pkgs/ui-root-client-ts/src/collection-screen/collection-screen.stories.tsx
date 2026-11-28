import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './collection-screen.example';
import { CollectionScreen } from './index';

const meta = {
  id: 'templates-search-and-collections',
  title: 'Templates/CollectionScreen',
  component: CollectionScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
