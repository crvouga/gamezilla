import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SuccessState } from './index';
import Example from './success-state.example';

const meta = {
  id: 'components-feedback-successstate',
  title: 'Molecules/SuccessState',
  component: SuccessState,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
