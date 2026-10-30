import type { SelectOption } from '@pkgs/ui-root-shared-ts/select-types';
import { useArgs } from 'storybook/preview-api';
import { expect, fn, mocked, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Select } from './index';
import Example from './select.example';

const FRUITS = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
] satisfies readonly SelectOption[];

const meta = {
  id: 'components-inputs-select',
  title: 'Atoms/Select',
  component: Select,
  tags: ['autodocs'],
  args: {
    label: 'Favorite fruit',
    options: FRUITS,
    value: 'banana',
    size: 'md',
    disabled: false,
    searchable: false,
    loading: false,
    error: '',
    onValueChange: fn(),
  },
  argTypes: {
    label: { control: 'text' },
    options: { control: false },
    value: { control: 'select', options: FRUITS.map((option) => option.value) },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    disabled: { control: 'boolean' },
    searchable: { control: 'boolean' },
    loading: { control: 'boolean' },
    error: { control: 'text' },
    onValueChange: { control: false },
    renderOption: { control: false },
    dataSet: { control: false },
    triggerDataSet: { control: false },
  },
  parameters: {
    test: { restoreMocks: false },
    controls: {
      include: [
        'label',
        'value',
        'size',
        'disabled',
        'searchable',
        'loading',
        'error',
      ],
    },
  },
} satisfies Meta<typeof Select>;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  tags: ['!manifest'],
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/** Choose one value from a known set of options; the parent retains the selection. */
export const Controlled: StoryObj<typeof meta> = {
  render: (args) => {
    const [, updateArgs] = useArgs();
    return (
      <Select
        {...args}
        onValueChange={(value) => {
          args.onValueChange(value);
          updateArgs({ value });
        }}
      />
    );
  },
};

/** Commit a choice from the selection surface and return to the collapsed field. */
export const Choose: StoryObj<typeof meta> = {
  ...Controlled,
  play: async ({ canvasElement, args, step }) => {
    mocked(args.onValueChange).mockClear();
    const trigger = within(canvasElement).getByRole('button', {
      name: 'Favorite fruit',
    });
    await step('Choose an option from the production surface', async () => {
      await userEvent.click(trigger);
      const dialog = within(canvasElement.ownerDocument.body).getByRole(
        'dialog',
        {
          name: 'Favorite fruit',
        }
      );
      await userEvent.click(
        within(dialog).getByRole('option', { name: 'Cherry' })
      );
      await expect(trigger).toHaveTextContent('Cherry');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
      await expect(args.onValueChange).toHaveBeenCalledWith('cherry');
    });
  },
};
