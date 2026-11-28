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

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
