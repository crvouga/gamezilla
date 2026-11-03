import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { LocalDatabaseBootErrorScreenView } from './boot-error-screen-view';

const meta = {
  id: 'screens-shell-local-database-boot-error',
  title: 'Screens/Shell/Local database boot error',
  component: LocalDatabaseBootErrorScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: {
    kind: 'failed',
    message: 'SQLITE_CANTOPEN: unable to open database file',
    onRetry: fn(),
  },
} satisfies Meta<typeof LocalDatabaseBootErrorScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The open failed outright: its own message, and Reload app. */
export const Failed: Story = {};

/** The open hung past the watchdog, as after a stale-worker update. */
export const Stuck: Story = { args: { kind: 'stuck' } };

/** Another tab stopped sharing the database: reset local data and reload. */
export const OpenInAnotherTab: Story = { args: { kind: 'otherTab' } };

/** A long open error wraps instead of overflowing the screen. */
export const LongMessage: Story = {
  args: {
    message: `OPFS SyncAccessHandle could not be created: NoModificationAllowedError ${'— the file is locked by another context; '.repeat(6)}`,
  },
};

/** The way forward runs the recovery the kind calls for. */
export const ResetAndReload: Story = {
  args: { kind: 'otherTab' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const reset = await canvas.findByRole('button', {
      name: 'Reset local data and reload',
    });
    await userEvent.click(reset);
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};
