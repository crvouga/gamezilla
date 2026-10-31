import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { List } from './index';
import Example from './list.example';

const meta = {
  id: 'components-data-display-list',
  title: 'Molecules/List',
  component: List,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
