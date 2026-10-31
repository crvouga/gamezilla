import { useArgs } from 'storybook/preview-api';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './button.example';
import { Button } from './index';

const meta = {
  id: 'components-inputs-button',
  title: 'Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: { test: { restoreMocks: false } },
  args: { onClick: fn() },
  argTypes: {
    title: { control: 'text' },
    intent: { control: 'select', options: ['primary', 'neutral', 'danger'] },
    variant: { control: 'select', options: ['solid', 'outline', 'ghost'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    feedback: {
      control: 'select',
      options: ['idle', 'loading', 'success', 'error'],
    },
    loadingLabel: { control: 'text' },
    successLabel: { control: 'text', if: { arg: 'feedback', eq: 'success' } },
    errorLabel: { control: 'text', if: { arg: 'feedback', eq: 'error' } },
    onClick: { control: false },
    onRetry: { control: false },
  },
  render: (args) => <Button {...args} />,
} satisfies Meta<typeof Button>;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  tags: ['!manifest'],
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/**
 * Use one primary button for the main action in a view; choose neutral intent
 * for alternatives. Controls explore the same production prop contract.
 * @summary The main action in a view
 */
export const Interactive: StoryObj<typeof meta> = {
  args: { title: 'Save', intent: 'primary', size: 'md', variant: 'solid' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Save' });
    button.focus();
    await expect(button).toHaveFocus();
  },
};
/** Keep the action visible but unavailable until its prerequisites are met. */
export const Disabled: StoryObj<typeof meta> = {
  args: { title: 'Save', disabled: true },
};
/** Prevent duplicate submissions and show progress while saving. */
export const Loading: StoryObj<typeof meta> = {
  args: { title: 'Save', loading: true, loadingLabel: 'Saving…' },
};
/** Confirm a lightweight save inline without navigating away. */
export const Success: StoryObj<typeof meta> = {
  args: { title: 'Save', feedback: 'success', successLabel: 'Saved' },
};
/** Preserve the action after failure and let the person retry in place. */
export const Retry: StoryObj<typeof meta> = {
  args: {
    title: 'Save',
    feedback: 'error',
    errorLabel: 'Could not save',
    onRetry: fn(),
  },
};

/** Uses the same args update channel as Controls and keeps a single Solid mount. */
export const ArgUpdates: StoryObj<typeof meta> = {
  tags: ['!manifest'],
  args: { title: 'Change label' },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return (
      <Button
        {...args}
        onClick={() => {
          args.onClick?.();
          updateArgs({ title: 'Updated label' });
        }}
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
