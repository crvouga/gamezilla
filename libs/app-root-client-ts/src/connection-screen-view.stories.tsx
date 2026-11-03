import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ConnectionScreenView } from './connection-screen-view';

const meta = {
  id: 'screens-settings-connection',
  title: 'Screens/Settings/Connection',
  component: ConnectionScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: {
    cause: 'connected',
    lastSyncedAtMs: Date.UTC(2026, 10, 2, 18, 30),
    version: '1.0.0',
    onCheckAgain: fn(),
  },
} satisfies Meta<typeof ConnectionScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The product answers: what you do is shared with everyone else. */
export const Connected: Story = {};

/** Reachability is being probed; the dot is pending. */
export const Checking: Story = { args: { cause: 'checking' } };

/** The person chose Work offline; "Check again" is disabled until they stop. */
export const WorkingOffline: Story = { args: { cause: 'workingOffline' } };

/** The device has no network: check Wi-Fi or mobile data. */
export const DeviceOffline: Story = { args: { cause: 'deviceOffline' } };

/** The device is online but the product is out of reach — not their doing. */
export const Unreachable: Story = { args: { cause: 'unreachable' } };

/** A device that has never reached the product says "Not yet". */
export const NeverConnected: Story = {
  args: { cause: 'unreachable', lastSyncedAtMs: null },
};

/** "Check again" probes the product once more. */
export const CheckAgain: Story = {
  args: { cause: 'unreachable' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const target = await canvas.findByRole('button', { name: 'Check again' });
    await userEvent.click(target);
    await expect(args.onCheckAgain).toHaveBeenCalledOnce();
  },
};
