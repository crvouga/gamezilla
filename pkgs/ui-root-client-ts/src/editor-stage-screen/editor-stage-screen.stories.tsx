import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './editor-stage-screen.example';
import { EditorStageScreen } from './index';

const meta = {
  id: 'templates-editor-stage-screen',
  title: 'Templates/EditorStageScreen',
  component: EditorStageScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Back, the title and details over the status line, the board, the commands. */
export const Saved: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/** A failed save says so between the header and the status, with its retry. */
export const SaveFailed: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example failed />,
};
