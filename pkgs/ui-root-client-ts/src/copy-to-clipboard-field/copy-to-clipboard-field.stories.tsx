import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './copy-to-clipboard-field.example';
import { CopyToClipboardField } from './index';

const meta = {
  title: 'Components/Inputs/CopyToClipboardField',
  component: CopyToClipboardField,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
