import { INITIAL_SYNC_STATUS } from '@pkgs/sync-engine-client-ts/sync-status';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { RefusedChangeCard } from './refused-change-notice';
import { SyncScreenView } from './sync-screen-view';

const CONNECTED = {
  ...INITIAL_SYNC_STATUS,
  connection: 'connected',
  hasSynced: true,
  hasEverSynced: true,
  lastSyncedAtMs: 1_700_000_000_000,
} as const;

const meta = {
  id: 'screens-settings-sync',
  title: 'Screens/Settings/Sync',
  component: SyncScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['status', 'refusedChanges'] },
  },
  args: { status: CONNECTED, onRetry: fn() },
} satisfies Meta<typeof SyncScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Connected and caught up: every state row reads yes, no error. */
export const Connected: Story = {};

/** Opening the connection: the dot is pending. */
export const Connecting: Story = {
  args: { status: { ...CONNECTED, connection: 'connecting' } },
};

/** Exchanging queries with the server: the dot is pending. */
export const Syncing: Story = {
  args: { status: { ...CONNECTED, connection: 'syncing' } },
};

/** A fresh device that has never synced and is not connected. */
export const NeverSynced: Story = { args: { status: INITIAL_SYNC_STATUS } };

/** Offline after syncing before: what is held locally still counts. */
export const Disconnected: Story = {
  args: {
    status: {
      ...CONNECTED,
      connection: 'disconnected',
      online: false,
      hasSynced: false,
    },
  },
};

/** The last sync failed: the dot warns and the error is shown, selectable. */
export const LastError: Story = {
  args: {
    status: {
      ...CONNECTED,
      lastError:
        'POST /api/query failed: 503 Service Unavailable (retrying in the background)',
    },
  },
};

/** Changes refused after they showed here are listed, each dismissible. */
export const WithRefusedChanges: Story = {
  render: (args) => (
    <SyncScreenView
      {...args}
      refusedChanges={
        <>
          <RefusedChangeCard
            refusal={{
              mutationId: '7d0e1b2c-0000-4000-8000-000000000001',
              mutationName: 'setDisplayLanguage',
              code: 'VALIDATION_FAILED',
              message: 'server message',
              meta: null,
            }}
            onDismiss={fn()}
          />
          <RefusedChangeCard
            refusal={{
              mutationId: '7d0e1b2c-0000-4000-8000-000000000002',
              mutationName: null,
              code: 'FORBIDDEN',
              message: 'server message',
              meta: null,
            }}
            onDismiss={fn()}
          />
        </>
      }
    />
  ),
};

/** "Retry sync" asks the engine to refresh its queries. */
export const RetrySync: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const target = await canvas.findByRole('button', { name: 'Retry sync' });
    await userEvent.click(target);
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};
