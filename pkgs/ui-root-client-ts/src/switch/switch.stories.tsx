import { useArgs } from 'storybook/preview-api';
import { expect, fn, mocked, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Switch } from './index';
import Example from './switch.example';

const meta = {
  id: 'components-inputs-switch',
  title: 'Atoms/Switch',
  component: Switch,
  tags: ['autodocs'],
  args: {
    label: 'Notifications',
    value: false,
    disabled: false,
    onValueChange: fn(),
  },
  argTypes: {
    label: { control: 'text' },
    value: { control: 'boolean' },
    disabled: { control: 'boolean' },
    onValueChange: { control: false },
    dataSet: { control: false },
  },
  parameters: {
    test: { restoreMocks: false },
    controls: { include: ['label', 'value', 'disabled'] },
  },
} satisfies Meta<typeof Switch>;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  tags: ['!manifest'],
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/** Turn a setting on or off immediately; use Checkbox for a choice submitted with a form. */
export const Controlled: StoryObj<typeof meta> = {
  render: (args) => {
    const [, updateArgs] = useArgs();
    return (
      <Switch
        {...args}
        onValueChange={(value) => {
          args.onValueChange(value);
          updateArgs({ value });
        }}
      />
    );
  },
};

/** Change a setting in place while keeping its visible state and callback value in sync. */
export const Toggle: StoryObj<typeof meta> = {
  ...Controlled,
  play: async ({ canvasElement, args, step }) => {
    mocked(args.onValueChange).mockClear();
    const control = within(canvasElement).getByRole('switch', {
      name: 'Notifications',
    });
    await step('Toggle and restore the controlled switch', async () => {
      await userEvent.click(control);
      await expect(control).toBeChecked();
      await expect(args.onValueChange).toHaveBeenLastCalledWith(true);
      await userEvent.click(control);
      await expect(control).not.toBeChecked();
      await expect(args.onValueChange).toHaveBeenLastCalledWith(false);
      await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    });
  },
};
