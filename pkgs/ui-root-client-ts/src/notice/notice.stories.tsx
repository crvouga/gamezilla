import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Notice } from './index';
import Example from './notice.example';

const meta = {
  id: 'components-feedback-notice',
  title: 'Molecules/Notice',
  component: Notice,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
