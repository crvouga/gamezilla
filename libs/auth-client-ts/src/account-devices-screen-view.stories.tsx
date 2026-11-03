import { Handles } from '@libs/test-ids-shared-ts/handles';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PHONE, TABLET, WEB } from './account-device.example';
import { AccountDevicesScreenView } from './account-devices-screen-view';

const meta = {
  id: 'screens-account-devices',
  title: 'Screens/Account/Devices',
  component: AccountDevicesScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['devices', 'copy'] },
  },
  args: {
    status: 'ready',
    devices: [PHONE, WEB, TABLET],
    accountId: '3c9d2f10-0000-4000-8000-0000000000aa',
    syncFailed: false,
    onSignIn: fn(),
    onOpenDevice: fn(),
    copy: fn(async () => undefined),
  },
} satisfies Meta<typeof AccountDevicesScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every install on the account, this one first with its session. */
export const Populated: Story = {};

/** A guest has no devices to list: the way forward is signing in. */
export const SignedOut: Story = { args: { status: 'signedOut', devices: [] } };

/** The local copy is not ready to paint yet. */
export const Loading: Story = { args: { status: 'loading', devices: [] } };

/** Signed in, but no device row has synced yet. */
export const Empty: Story = { args: { devices: [] } };

/** The first sync failed: only this device is known, and the notice says so. */
export const SyncFailed: Story = {
  args: { devices: [PHONE], syncFailed: true },
};

/** Long device names and versions clamp to one line per caption. */
export const LongNames: Story = {
  args: {
    devices: [
      {
        ...PHONE,
        deviceName:
          'Avery’s extremely long named phone that keeps going and going',
        osVersion: '18.4.1 (22E252) beta release candidate',
      },
      WEB,
    ],
  },
};

/** Pressing a device opens its detail. */
export const OpenDevice: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId(Handles.accountDevice(WEB.id))
    );
    await expect(args.onOpenDevice).toHaveBeenCalledWith(WEB.id);
  },
};
