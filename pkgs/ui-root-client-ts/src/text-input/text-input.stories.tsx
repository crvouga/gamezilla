import { useArgs } from 'storybook/preview-api';
import { expect, fn, mocked, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TextInput } from './index';
import Example from './text-input.example';

const meta = {
  id: 'components-inputs-textinput',
  title: 'Atoms/TextInput',
  component: TextInput,
  tags: ['autodocs'],
  args: {
    value: '',
    label: 'Name',
    disabled: false,
    invalid: false,
    secureTextEntry: false,
    variant: 'default',
    onChangeText: fn(),
    onSubmitEditing: fn(),
  },
  argTypes: {
    value: { control: 'text' },
    label: { control: 'text' },
    variant: { control: 'inline-radio', options: ['default', 'embedded'] },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
    secureTextEntry: { control: 'boolean' },
    onChangeText: { control: false },
    onSubmitEditing: { control: false },
  },
  parameters: {
    test: { restoreMocks: false },
    layout: 'padded',
    controls: {
      include: [
        'value',
        'label',
        'variant',
        'disabled',
        'invalid',
        'secureTextEntry',
      ],
    },
  },
} satisfies Meta<typeof TextInput>;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  tags: ['!manifest'],
  parameters: { layout: 'fullscreen', controls: { disable: true } },
  render: () => <Example />,
};

/** Collect a name in a labeled field while the parent retains the current draft. */
export const Controlled: StoryObj<typeof meta> = {
  render: (args) => {
    const [, updateArgs] = useArgs();
    return (
      <TextInput
        {...args}
        onChangeText={(value) => {
          args.onChangeText(value);
          updateArgs({ value });
        }}
      />
    );
  },
};

/** Submit the current draft with Enter without losing the text the person entered. */
export const Submit: StoryObj<typeof meta> = {
  ...Controlled,
  play: async ({ canvasElement, args, step }) => {
    mocked(args.onChangeText).mockClear();
    mocked(args.onSubmitEditing)?.mockClear();
    const field = within(canvasElement).getByRole('textbox');
    await step('Type a name and submit with Enter', async () => {
      await userEvent.type(field, 'Alex');
      await expect(field).toHaveValue('Alex');
      await expect(args.onChangeText).toHaveBeenLastCalledWith('Alex');
      await userEvent.keyboard('{Enter}');
      await expect(args.onSubmitEditing).toHaveBeenCalledTimes(1);
    });
  },
};
