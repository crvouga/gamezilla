import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FilePicker } from './index';
export default {
  title: 'Components/Inputs/FilePicker',
  component: FilePicker,
  tags: ['autodocs'],
  args: {
    label: 'Choose an image',
    accept: 'image/*',
    onSelect: () => undefined,
  },
} satisfies Meta<typeof FilePicker>;
export const Ready: StoryObj<typeof FilePicker> = {};
export const Disabled: StoryObj<typeof FilePicker> = {
  args: { disabled: true },
};
