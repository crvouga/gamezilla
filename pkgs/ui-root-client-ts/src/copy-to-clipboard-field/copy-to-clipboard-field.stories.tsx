import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './copy-to-clipboard-field.example';
import { CopyToClipboardField } from './index';

const meta = {
  id: 'components-inputs-copytoclipboardfield',
  title: 'Molecules/CopyToClipboardField',
  component: CopyToClipboardField,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
