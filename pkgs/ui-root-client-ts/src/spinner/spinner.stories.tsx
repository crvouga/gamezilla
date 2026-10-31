import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Spinner } from './index';
import Example from './spinner.example';

const meta = {
  id: 'components-feedback-spinner',
  title: 'Atoms/Spinner',
  component: Spinner,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
