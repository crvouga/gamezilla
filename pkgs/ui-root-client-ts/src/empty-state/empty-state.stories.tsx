import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './empty-state.example';
import { EmptyState } from './index';

const meta = {
  id: 'components-feedback-emptystate',
  title: 'Molecules/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
