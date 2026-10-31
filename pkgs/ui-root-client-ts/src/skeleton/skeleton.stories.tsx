import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Skeleton } from './index';
import Example from './skeleton.example';

const meta = {
  id: 'components-feedback-skeleton',
  title: 'Atoms/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
