import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PHONE, TABLET, WEB } from './account-device.example';
import { AccountDeviceDetailScreenView } from './account-device-detail-screen-view';

const meta = {
  id: 'screens-account-device-detail',
  title: 'Screens/Account/Device detail',
  component: AccountDeviceDetailScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['device', 'copy'] },
  },
  args: {
    status: 'ready',
    device: PHONE,
    copy: fn(async () => undefined),
  },
} satisfies Meta<typeof AccountDeviceDetailScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** This install: badge, its session and when that session expires. */
export const CurrentDevice: Story = {};

/** Another install: no session visible from here, its browser user agent. */
export const OtherDevice: Story = { args: { device: WEB } };

/** A device that reported almost nothing: the id-based title and dashes. */
export const SparseDevice: Story = { args: { device: TABLET } };

/** The link names no device at all. */
export const MissingId: Story = { args: { status: 'missingId', device: null } };

/** The device row is still being read. */
export const Loading: Story = { args: { status: 'loading', device: null } };

/** This copy holds no row for the device: signed out, or not synced yet. */
export const NotFound: Story = { args: { status: 'notFound', device: null } };

/** Long names and versions wrap rather than overflow. */
export const LongValues: Story = {
  args: {
    device: {
      ...PHONE,
      deviceName:
        'Avery’s extremely long named phone that keeps going and going',
      deviceModelName: 'iPhone 15 Pro Max (A3106) international edition',
      appVersion: '2.14.0-beta.12+exp.sha.5114f85',
    },
  },
};
