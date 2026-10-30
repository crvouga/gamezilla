import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TestCommandProbe } from './index';
import Example from './test-command-probe.example';

const meta = {
  title: 'Primitives/TestCommandProbe',
  component: TestCommandProbe,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
