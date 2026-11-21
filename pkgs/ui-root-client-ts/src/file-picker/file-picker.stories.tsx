import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FilePicker } from './index';

const meta = {
  id: 'components-inputs-filepicker',
  title: 'Molecules/FilePicker',
  component: FilePicker,
  tags: ['autodocs'],
  args: {
    label: 'Choose an image',
    accept: 'image/*',
    chooseLabel: 'Choose file',
    emptyLabel: 'No file chosen',
    fileName: null,
    hint: 'A .png or .jpg image.',
    onSelect: fn(),
  },
  argTypes: {
    label: { control: 'text' },
    accept: { control: 'text' },
    disabled: { control: 'boolean' },
    onSelect: { control: false },
    dataSet: { control: false },
  },
} satisfies Meta<typeof FilePicker>;
export default meta;
export const Ready: StoryObj<typeof meta> = {};
/** A chosen file is named in the field, as its screen says it. */
export const Chosen: StoryObj<typeof meta> = {
  args: { fileName: 'avatar-for-the-weekend-tournament.png' },
};
export const Disabled: StoryObj<typeof meta> = {
  args: { disabled: true },
};

export const Selected: StoryObj<typeof meta> = {
  play: async ({ canvasElement, args, step }) => {
    const file = new File(['image'], 'avatar.png', {
      type: 'image/png',
      lastModified: 0,
    });
    await step('Select an image and expose its callback payload', async () => {
      await userEvent.upload(
        within(canvasElement).getByLabelText('Choose an image'),
        file
      );
      await expect(args.onSelect).toHaveBeenCalledTimes(1);
      await expect(args.onSelect).toHaveBeenCalledWith(file);
    });
  },
};
