import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { LoadingState } from './index';
import Example from './loading-state.example';

const meta = {
  id: 'components-feedback-loadingstate',
  title: 'Molecules/LoadingState',
  component: LoadingState,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
