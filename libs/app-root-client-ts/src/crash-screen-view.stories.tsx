import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { CrashScreenView } from './crash-screen-view';

const meta = {
  id: 'screens-shell-crash',
  title: 'Screens/Shell/Crash',
  component: CrashScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: {
    message:
      'useAuthModals: AuthModalsProvider missing — wrap with AppProviders',
    copyPhase: 'idle',
    onTryAgain: fn(),
    onGoToSpaces: fn(),
    onReload: fn(),
    onCopy: fn(),
  },
} satisfies Meta<typeof CrashScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A screen crashed before telemetry answered: recovery first, no reference. */
export const Crashed: Story = {};

/** Telemetry reported the crash: its reference is shown and copied. */
export const WithReference: Story = {
  args: { reference: '4bf92f3577b34da6a3ce929d0e0e4736' },
};

/** The clipboard write is in flight; Copy error is disabled meanwhile. */
export const Copying: Story = { args: { copyPhase: 'pending' } };

/** The details were copied; the button and the status say so. */
export const Copied: Story = { args: { copyPhase: 'copied' } };

/** The clipboard refused; the status offers retrying or selecting the text. */
export const CopyFailed: Story = { args: { copyPhase: 'error' } };

/** A long message wraps and scrolls inside the disclosed details. */
export const LongMessageDetails: Story = {
  args: {
    message: `TypeError: Cannot read properties of undefined (reading 'board') ${'while rendering the puzzle feed after a sync rebase; '.repeat(12)}`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const disclosure = await canvas.findByRole('button', {
      name: 'Error details',
    });
    await userEvent.click(disclosure);
    const details = await canvas.findByRole('region', {
      name: 'Error message',
    });
    await expect(details).toBeVisible();
  },
};
