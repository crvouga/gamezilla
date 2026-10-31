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

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
