import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './file-trigger.example';
import { FileTrigger } from './index';

const meta = {
  id: 'components-inputs-filetrigger',
  title: 'Molecules/FileTrigger',
  component: FileTrigger,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
