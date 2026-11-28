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

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
