import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './editor-workbench.example';
import { EditorWorkbench } from './index';

const meta = {
  id: 'components-layout-editorworkbench',
  title: 'Molecules/EditorWorkbench',
  component: EditorWorkbench,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** The tools beside the canvas when wide, over it on a phone. */
export const ToolsBeside: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
