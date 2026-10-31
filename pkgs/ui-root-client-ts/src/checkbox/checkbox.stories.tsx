import { useArgs } from 'storybook/preview-api';
import { expect, fn, mocked, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './checkbox.example';
import { Checkbox } from './index';

const meta = {
  id: 'components-inputs-checkbox',
  title: 'Atoms/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  args: {
    checked: false,
    label: 'Receive invitations',
    disabled: false,
    indeterminate: false,
    onToggle: fn(),
  },
  argTypes: {
    checked: { control: 'boolean' },
    label: { control: 'text' },
    disabled: { control: 'boolean' },
    indeterminate: { control: 'boolean' },
    onToggle: { control: false },
    dataSet: { control: false },
  },
  parameters: { test: { restoreMocks: false }, layout: 'centered' },
} satisfies Meta<typeof Checkbox>;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  tags: ['!manifest'],
  parameters: { layout: 'fullscreen', controls: { disable: true } },
  render: () => <Example />,
};

/** Let a person opt into invitations with an independent checked choice. */
export const Controlled: StoryObj<typeof meta> = {
  render: (args) => {
    const [, updateArgs] = useArgs();
    return (
      <Checkbox
        {...args}
        onToggle={(checked) => {
          args.onToggle(checked);
          updateArgs({ checked, indeterminate: false });
        }}
      />
    );
  },
};

/** Opt in and back out without committing a form; the parent owns the checked value. */
export const Toggle: StoryObj<typeof meta> = {
  ...Controlled,
  play: async ({ canvasElement, args, step }) => {
    mocked(args.onToggle).mockClear();
    const checkbox = within(canvasElement).getByRole('checkbox');
    await step('Toggle and restore the controlled value', async () => {
      await userEvent.click(checkbox);
      await expect(checkbox).toBeChecked();
      await expect(args.onToggle).toHaveBeenCalledWith(true);
      await userEvent.click(checkbox);
      await expect(checkbox).not.toBeChecked();
      await expect(args.onToggle).toHaveBeenLastCalledWith(false);
    });
  },
};
