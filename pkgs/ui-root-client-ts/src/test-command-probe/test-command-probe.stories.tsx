import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TestCommandProbe } from './index';
import Example from './test-command-probe.example';

const meta = {
  id: 'primitives-testcommandprobe',
  title: 'Atoms/TestCommandProbe',
  component: TestCommandProbe,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
