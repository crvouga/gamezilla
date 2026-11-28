import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { LogLine } from './index';
import Example from './log-line.example';

const meta = {
  id: 'primitives-logline',
  title: 'Atoms/LogLine',
  component: LogLine,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
