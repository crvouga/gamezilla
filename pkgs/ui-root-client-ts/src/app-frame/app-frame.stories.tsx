import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './app-frame.example';
import { AppFrame } from './index';

const meta = {
  id: 'layouts-appframe',
  title: 'Templates/AppFrame',
  component: AppFrame,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
