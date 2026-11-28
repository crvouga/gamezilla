import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './code-block.example';
import { CodeBlock } from './index';

const meta = {
  id: 'primitives-codeblock',
  title: 'Atoms/CodeBlock',
  component: CodeBlock,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
