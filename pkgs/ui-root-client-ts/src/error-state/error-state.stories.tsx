import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './error-state.example';
import { ErrorState } from './index';

const meta = {
  title: 'Components/Feedback/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
