import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './error-state.example';
import { ErrorState } from './index';

const meta = {
  id: 'components-feedback-errorstate',
  title: 'Molecules/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
