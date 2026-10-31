import { useArgs } from 'storybook/preview-api';
import { expect, fn, mocked, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { NumberStepper } from './index';
import Example from './number-stepper.example';

const meta = {
  id: 'components-inputs-numberstepper',
  title: 'Atoms/NumberStepper',
  component: NumberStepper,
  tags: ['autodocs'],
  args: {
    label: 'Players',
    value: 4,
    min: 2,
    max: 8,
    step: 1,
    disabled: false,
    onChange: fn(),
  },
  argTypes: {
    label: { control: 'text' },
    value: { control: { type: 'number', min: 2, max: 8, step: 1 } },
    min: { control: 'select', options: [0, 1, 2] },
    max: { control: 'select', options: [8, 10, 12] },
    step: { control: 'select', options: [1, 2] },
    disabled: { control: 'boolean' },
    onChange: { control: false },
    dataSet: { control: false },
  },
  parameters: {
    test: { restoreMocks: false },
    controls: {
      include: ['label', 'value', 'min', 'max', 'step', 'disabled'],
    },
  },
} satisfies Meta<typeof NumberStepper>;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  tags: ['!manifest'],
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/** Adjust a player count within explicit bounds, one step at a time. */
export const Controlled: StoryObj<typeof meta> = {
  render: (args) => {
    const [, updateArgs] = useArgs();
    return (
      <NumberStepper
        {...args}
        onChange={(value) => {
          args.onChange(value);
          updateArgs({ value });
        }}
      />
    );
  },
};

/** Let keyboard users adjust the count and reach either bound without exceeding it. */
export const Keyboard: StoryObj<typeof meta> = {
  ...Controlled,
  play: async ({ canvasElement, args, step }) => {
    mocked(args.onChange).mockClear();
    const canvas = within(canvasElement);
    const value = canvas.getByRole('spinbutton', { name: 'Players' });
    await step('Step the value and jump to each bound', async () => {
      await userEvent.click(value);
      await userEvent.keyboard('{ArrowUp}');
      await expect(value).toHaveAttribute('aria-valuenow', '5');
      await expect(args.onChange).toHaveBeenLastCalledWith(5);
      await userEvent.keyboard('{End}');
      await expect(value).toHaveAttribute('aria-valuenow', '8');
      await expect(
        canvas.getByRole('button', { name: /^Increase / })
      ).toBeDisabled();
      await userEvent.keyboard('{Home}');
      await expect(value).toHaveAttribute('aria-valuenow', '2');
      await expect(
        canvas.getByRole('button', { name: /^Decrease / })
      ).toBeDisabled();
      await expect(args.onChange).toHaveBeenLastCalledWith(2);
      await expect(args.onChange).toHaveBeenCalledTimes(3);
    });
  },
};
