import { useArgs } from 'storybook/preview-api';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './button.example';
import { Button } from './index';

const meta = {
  title: 'Components/Inputs/Button',
  component: Button,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/** Edit props in Controls; the renderer must preserve a single reactive owner. */
export const Interactive: StoryObj<typeof Button> = {
  args: { title: 'Save', intent: 'primary', size: 'md', variant: 'solid' },
  argTypes: {
    title: { control: 'text' },
    intent: { control: 'select', options: ['primary', 'neutral', 'danger'] },
    variant: { control: 'select', options: ['solid', 'outline', 'ghost'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
  },
  render: (args) => <Button {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Save' });
    button.focus();
    await expect(button).toHaveFocus();
  },
};
export const Disabled: StoryObj<typeof Button> = {
  args: { title: 'Save', disabled: true },
  render: (args) => <Button {...args} />,
};
export const Loading: StoryObj<typeof Button> = {
  args: { title: 'Save', loading: true, loadingLabel: 'Saving…' },
  render: (args) => <Button {...args} />,
};
export const Success: StoryObj<typeof Button> = {
  args: { title: 'Save', feedback: 'success', successLabel: 'Saved' },
  render: (args) => <Button {...args} />,
};
export const Retry: StoryObj<typeof Button> = {
  args: {
    title: 'Save',
    feedback: 'error',
    errorLabel: 'Could not save',
    onRetry: () => undefined,
  },
  render: (args) => <Button {...args} />,
};

/** Uses the same args update channel as Controls and keeps a single Solid mount. */
export const ArgUpdates: StoryObj<typeof Button> = {
  args: { title: 'Change label' },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return (
      <Button
        {...args}
        onClick={() => updateArgs({ title: 'Updated label' })}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Change label' }));
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Updated label' })
      ).toBeInTheDocument()
    );
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
  },
};
