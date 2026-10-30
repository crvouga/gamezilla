import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SuccessState } from './index';
import Example from './success-state.example';

const meta = {
  title: 'Components/Feedback/SuccessState',
  component: SuccessState,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
