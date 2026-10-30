import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MutationModal } from './index';
import Example, { MutationModalStateExample } from './mutation-modal.example';

const meta = {
  id: 'components-overlay-mutationmodal',
  title: 'Organisms/MutationModal',
  component: MutationModal,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  tags: ['!manifest'],
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
type MutationArgs = {
  outcome: 'success' | 'retry';
  onOperation: (attempt: number) => void;
  onClose: () => void;
};

/** Ask for confirmation before ending a space; keep the outcome in the same dialog. */
export const Confirm: StoryObj<MutationArgs> = {
  args: { outcome: 'success', onOperation: fn(), onClose: fn() },
  argTypes: {
    outcome: { control: 'inline-radio', options: ['success', 'retry'] },
    onOperation: { control: false },
    onClose: { control: false },
  },
  parameters: { controls: { include: ['outcome'] } },
  render: (args) => <MutationModalStateExample {...args} />,
};

/** Keep the dialog open with progress while the confirmed operation is pending. */
export const Loading: StoryObj<MutationArgs> = {
  ...Confirm,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'End space' }));
    await expect(canvas.getByText('Ending space…')).toBeVisible();
    await expect(args.onOperation).toHaveBeenCalledTimes(1);
    await expect(args.onOperation).toHaveBeenLastCalledWith(1);
  },
};

function advanceOperation(canvasElement: HTMLElement): void {
  canvasElement.dispatchEvent(
    new CustomEvent('advance-story-time', { detail: 900 })
  );
}

/** Confirm the completed operation and let the person dismiss the result. */
export const Success: StoryObj<MutationArgs> = {
  ...Confirm,
  play: async (context) => {
    await Loading.play?.(context);
    advanceOperation(context.canvasElement);
    await waitFor(() =>
      expect(
        within(context.canvasElement).getByRole('status')
      ).toHaveTextContent('Space ended')
    );
    await expect(
      within(context.canvasElement).getByRole('button', {
        name: 'Done',
      })
    ).toBeVisible();
  },
};

/** A refused operation retains the dialog and offers a safe retry. */
export const Error: StoryObj<MutationArgs> = {
  ...Confirm,
  args: { ...Confirm.args, outcome: 'retry' },
  play: async (context) => {
    await Loading.play?.(context);
    advanceOperation(context.canvasElement);
    await expect(
      await within(context.canvasElement).findByRole('alert')
    ).toHaveTextContent('Connection interrupted. Try again.');
    await expect(
      within(context.canvasElement).getByRole('button', {
        name: 'Try again',
      })
    ).toBeVisible();
  },
};

/** Retry a refused operation in the same dialog without repeating the confirmation. */
export const Recovery: StoryObj<MutationArgs> = {
  ...Error,
  play: async (context) => {
    await Error.play?.(context);
    const canvas = within(context.canvasElement);
    await context.step('Retry the refused operation', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
      await expect(canvas.getByText('Ending space…')).toBeVisible();
      await expect(context.args.onOperation).toHaveBeenLastCalledWith(2);
      advanceOperation(context.canvasElement);
      await waitFor(() =>
        expect(canvas.getByRole('status')).toHaveTextContent('Space ended')
      );
      await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    });
  },
};
