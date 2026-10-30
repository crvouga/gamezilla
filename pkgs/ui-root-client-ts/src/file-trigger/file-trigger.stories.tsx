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

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
