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

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
