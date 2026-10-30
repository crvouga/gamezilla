import { useTimers } from '@pkgs/clock-client-ts/solid';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Button } from './index';

export default {
  id: 'patterns-asynchronous-save',
  title: 'Organisms/Patterns/Asynchronous save',
  component: Button,
  tags: ['autodocs'],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof Button>;

export const Saved: StoryObj = {
  render: () => {
    const timers = useTimers();
    const save = useMutationButton({
      operation: () =>
        new Promise<void>((resolve) => {
          timers.setTimeout(resolve, 1000);
        }),
      labels: {
        idle: 'Save',
        loading: 'Saving…',
        success: 'Saved',
        error: 'Try saving again',
      },
    });
    return <Button {...save.buttonProps} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(canvas.getByRole('button')).toHaveAttribute(
      'aria-busy',
      'true'
    );
    canvasElement.dispatchEvent(
      new CustomEvent('advance-story-time', { detail: 1000 })
    );
    await waitFor(() =>
      expect(canvas.getByRole('button')).toHaveTextContent('Saved')
    );
  },
};
