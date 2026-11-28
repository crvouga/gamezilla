import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MarkdownEditor } from './index';
import Example from './markdown-editor.example';

const meta = {
  id: 'components-inputs-markdowneditor',
  title: 'Organisms/MarkdownEditor',
  component: MarkdownEditor,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
