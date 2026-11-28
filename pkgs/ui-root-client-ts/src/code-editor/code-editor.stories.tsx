import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './code-editor.example';
import { CodeEditor } from './index';

const meta = {
  id: 'components-inputs-codeeditor',
  title: 'Molecules/CodeEditor',
  component: CodeEditor,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
