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

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
