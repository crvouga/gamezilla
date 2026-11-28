import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Spacer } from './index';
import Example from './spacer.example';

const meta = {
  id: 'layouts-spacer',
  title: 'Atoms/Spacer',
  component: Spacer,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
